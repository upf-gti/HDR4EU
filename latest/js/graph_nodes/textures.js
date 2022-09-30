/*
*   author: Alex Rodriguez
*   @jxarco 
*/

function LGraphFrame()
{
   /* this.addInput("Shader", "Shader");
    this.addInput("Skybox", "Skybox");*/

    this.addOutput("Color","Texture");
    this.addOutput("Normal","Texture");
    this.addOutput("Depth","Texture");
    this.addOutput("Material","Texture");
    this.addOutput("Camera","Camera");
    
    this.properties = {};
    this.size[0] = 170;
}

LGraphFrame.title = "Frame";
LGraphFrame.desc = "One frame rendered from the scene renderer";

LGraphFrame.prototype.onExecute = function()
{
    if(!CORE || !gui)
    return;

    var cubeTex    = this.getInputDataByName( "Skybox", true );
    var shader  = this.getInputDataByName( "Shader", true );

    // TODO: put atmos shader code in atmos node and pass a shader instance
    if(shader)
        CORE.cubemap.shader = shader;
    else
        CORE.cubemap.shader = "skybox";

    if(cubeTex)
        CORE.cubemap.texture = cubeTex;
    else if(gl.textures[CORE._environment])
    {
        CORE.cubemap.texture = CORE._environment;
        CORE.cubemap._uniforms["u_blur"] = gui._usePrem0;
    }

    this.setOutputData(0, CORE.texture_color );
    this.setOutputData(1, CORE.texture_normal);

    // linearize shadowmap in case of spot 
    // (z in directional is linear due to orthographic projection)

    if ( !this.tmp ) {
        this.tmp = new Texture(CORE.texture_depth.width, CORE.texture_depth.height, {type: GL.FLOAT, filter: GL.LINEAR});
    }
    
    var shader = gl.shaders["toLinear"];
    var camera = CORE.controller.camera;
    this.tmp.drawTo( function()
    {
        CORE.texture_depth.toViewport( shader, {
            u_near:  camera.near,
            u_far:  camera.far,
            u_linearize: false
        } );
    });

    this.setOutputData(2, this.tmp );
    //this.setOutputData(2, CORE.texture_depth );
    this.setOutputData(3, CORE.texture_lighting);

    var cam_slot = this.findOutputSlot( "Camera" );
    if( cam_slot > -1 )
        this.setOutputData(cam_slot, camera );
}

LGraphFrame.prototype.onGetInputs = function()
{   
    var inputs = [
        ["Shader", "Shader"],
        ["Skybox", "Skybox"]
    ];

    if(!this.inputs)
    return inputs;

    var filtered_inputs = [];

    for(var i in inputs)
    {
        var slot_name = inputs[i][0];
        if(this.findInputSlot(slot_name) < 0)
            filtered_inputs.push( inputs[i] );
    }

    return filtered_inputs;
}

LGraphFrame.prototype.onGetOutputs = function()
{   
    var outputs = [
        ["Camera", "Camera"],
    ];

    var filtered_outputs = [];

    for(var i in outputs)
    {
        var slot_name = outputs[i][0];
        if(this.findOutputSlot(slot_name) < 0)
            filtered_outputs.push( outputs[i] );
    }

    return filtered_outputs;
}

LiteGraph.registerNodeType("texture/frame", LGraphFrame );

// Texture Average  *****************************************
function LGraphTextureAverage() {
    this.addInput("Texture", "Texture");
    this.addOutput("Texture", "Texture");
    this.addOutput("Avg", "number");

    this._uniforms = {
        u_texture: 0
    };
    this._luminance = new Float32Array(4);
    this._temp_texture = null;
}

LGraphTextureAverage.title = "Average";

LGraphTextureAverage.prototype.onExecute = function() {
    
    this.updateAverage();

    var v = this._luminance;
    this.setOutputData(0, this._temp_texture);
    this.setOutputData(1, v);
};

LGraphTextureAverage.prototype.updateAverage = function() {
    
    var input = this.getInputData(0);
    if (!input) {
        return;
    }

    if (
        !this.isOutputConnected(0) &&
        !this.isOutputConnected(1)
    ) {
        return;
    } //saves work

    if (!LGraphTextureAverage._shader) {
        LGraphTextureAverage._shader = new GL.Shader(
            GL.Shader.SCREEN_VERTEX_SHADER,
            LGraphTextureAverage.pixel_shader
        );
    }

    var type = gl.FLOAT;

    var temp = new GL.Texture( 64, 64, { type: type, format: gl.RGBA, minFilter: gl.LINEAR_MIPMAP_LINEAR });

    temp.drawTo(function(){
        input.toViewport();
    });

    this._temp_texture = temp;

    var pixelColor = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

    var properties = { mipmap_offset: 0, low_precision: false };
    var uniforms = { u_mipmap_offset: properties.mipmap_offset };

    var shader = gl.shaders['luminance'];

    if(!shader)
        throw("no luminance shader");

    pixelColor.drawTo(function(){
        temp.toViewport( shader, uniforms );
    });

    var pixel = pixelColor.getPixels();
    // do eye adaptation
    if(pixel) 
    {
        Lnew = pixel[0];
        this._luminance = Lnew;
    }

};

LGraphTextureAverage.pixel_shader =
    "precision highp float;\n\
    uniform sampler2D u_texture;\n\
    \n\
    void main() {\n\
        int k = 0;\n\
        const float delta = 0.0001;\n\
        float sumLog = 0.0;\n\
        float sum = 0.0;\n\
        const float width = float(16);\n\
        const float height = float(16);\n\
        \n\
        for(float i = 0.5; i < width; i++)\n\
        for(float j = 0.5; j < height; j++)\n\
        {\n\
            vec2 coord = vec2(i, j) / vec2(width, height);\n\
            vec4 pixelColor = texture2D(u_texture, coord);\n\
            \n\
            float lum = max( 0.2126 * pixelColor.r + 0.7152 * pixelColor.g + 0.0722 * pixelColor.b, 0.0);\n\
            float logLum = log( lum + delta ) + delta;\n\
            sum += lum;\n\
            sumLog += logLum;\n\
            k++;\n\
        }\n\
        \n\
        float averageLum = sum / float(k);\n\
        float averageLogLum = sumLog / float(k);\n\
        gl_FragColor = vec4(averageLum, averageLogLum, 0.0, 1.0);\n\
    }\n\
    ";

LiteGraph.registerNodeType("texture/average", LGraphTextureAverage);
/*
*   Alex Rodri­guez
*   @jxarco 
*/

function setScene( filename )
{
    last_em = current_em;
    current_em = HDRTool.getName( filename );;
    
    showLoading();

    var params = {oncomplete: displayScene};

    if(renderer.textures[ "_prem_0_" + current_em ])
        displayScene();
    else
    {
        // Load hdre pre-processed files
        if( filename.includes(".hdre") )
            HDRTool.load( filename, params); 
        else // Load and prefilter exr files
            HDRTool.prefilter( filename, params );
    }
}

function displayScene()
{
    // delete previous em (free memory)
    for(var t in gl.textures)
        if(t.includes( last_em ) && last_em != current_em)
            delete gl.textures[t];

    // load all prefiltered EMS
    if(renderer.textures[current_em])
        updateNodeTextures(current_em);

    // config scene
    skybox.texture = current_em;
    skybox.flags.visible = true;

    params_gui['Scene'] = findTexPath(current_em);
    gui.updateDisplay();
    gui.domElement.style.display = "block";

    removeLoading( () => $(".pbar").css("width", "0%") );
    showMessage( current_em );
    console.log(`%cUsing environment: ${current_em}`, 'background: #333; color: #AAF; font-weight: bold; padding: 5px; font-size; 18px;');

    if( params_gui['Mesh'] == "" )
        parseSceneFigure( "Sphere" );
}

function parseSceneFigure( name )
{
    // remove previous matrix
    removeByName( 'matrix_node' );
    removeByName( 'roughness_scale_node' );
    removeByName( 'metalness_scale_node' );

    var toParse = scenes[name];

    params_gui['Mesh'] = name;
    gui.updateDisplay();

    // model has to be seen?
    model.flags.visible = toParse.useModel || false;

    // update camera by default
    camera.lookAt( toParse.camera.eye, toParse.camera.target, toParse.camera.up );

    switch( name )
    {
        case "Sphere":
            model.mesh = "sphere";
            model.shader = toParse.shader;
            break;
        case "Matrix":
            drawMatrix( current_em );
            break;
        case "Roughness scale":
            drawScale( current_em, true, { property: 'roughness' } );
            break;
        case "Metalness scale":
            drawScale( current_em, true, { property: 'metalness', aux_prop: 0.5 } );
            break;
        default:
            renderer.loadMesh(toParse.mesh, function(res){

                if(!res) throw( "No mesh loaded" );

                // set configuration
                model.mesh = toParse.mesh;
                model.shader = toParse.shader;

                let bb = gl.meshes[toParse.mesh].getBoundingBox();

                // update target from bb
                camera.lookAt( toParse.camera.eye, [bb[0], bb[1], bb[2]], toParse.camera.up );

                if( toParse.uniforms )
                {
                    model._uniforms["u_roughness"] = toParse.uniforms["u_roughness"];
                    model._uniforms["u_metalness"] = toParse.uniforms["u_metalness"];
                }

                // update node uniforms
                if(toParse.shader == "pbr")
                {
                    model.textures['roughness'] = assets_folder + name +"/roughness.png";
                    model.textures['metalness'] = assets_folder + name +"/metalness.png";
                    model.textures['albedo'] = assets_folder + name +"/albedo.png";
                    model.textures['normal'] = assets_folder + name +"/normal.png";
                    model.textures['ao'] = assets_folder + name +"/ao.png";

                    // other textures
                    if(toParse.hasOpacity)
                    {
                        model._uniforms["u_hasAlpha"] = true;
                        model.textures['opacity'] = assets_folder + name +"/opacity.png";
                    }
                    else
                    {
                        model._uniforms["u_hasAlpha"] = false;
                        delete model.textures['opacity'];
                    }

                    if(toParse.isEmissive)
                    {
                        model._uniforms["u_isEmissive"] = true;
                        model.textures['emissive'] = assets_folder + name +"/emissive.png";
                    }
                    else
                    {
                        model._uniforms["u_isEmissive"] = false;
                        delete model.textures['emissive'];
                    }
                }
                
            });
    }

    removeLoading();
}

function updateNodeTextures(em)
{
    let nodes = [];

    nodes.push(model);
    nodes.push(getNodeByName('matrix_node'));
    nodes.push(getNodeByName('roughness_scale_node'));
    nodes.push(getNodeByName('metalness_scale_node'));

    for (var i = 0; i < nodes.length; i++)
    {
        let node = nodes[i];

        if(!node)
            continue;

        node.textures['env'] = em;
        node.textures['env_1'] = "_prem_0_" + em;
        node.textures['env_2'] = "_prem_1_" + em;
        node.textures['env_3'] = "_prem_2_" + em;
        node.textures['env_4'] = "_prem_3_" + em;
        node.textures['env_5'] = "_prem_4_" + em;

        if(!node.children.length)
            continue;

        for (var j = 0; j < node.children.length;  j++)
        {
            let child = node.children[j];

            child.textures['env'] = em;
            child.textures['env_1'] = "_prem_0_" + em;
            child.textures['env_2'] = "_prem_1_" + em;
            child.textures['env_3'] = "_prem_2_" + em;
            child.textures['env_4'] = "_prem_3_" + em;
            child.textures['env_5'] = "_prem_4_" + em;
        }
    }
}


function setSkybox( scene )
{
    var skybox = new RD.SceneNode();
    skybox.name = "Skybox";
    skybox.mesh = "cube";
    skybox.shader = "skyboxExpo";
    skybox.flags.depth_test = false;
    skybox.flags.flip_normals = true;
    skybox.flags.visible = false;
    mat4.invert($temp.mat4, camera._viewprojection_matrix);
    skybox._uniforms['u_inv_viewprojection_matrix'] = $temp.mat4;
    skybox.render_priority = RD.PRIORITY_BACKGROUND;
    scene.root.addChild( skybox );
    return skybox;
}

function getNodeByName( name )
{
    for(var i = 0; i < scene.root.children.length; i++)
    {
        if(scene.root.children[i].name == name)
            return scene.root.children[i];
    }

    return null;
}

function removeByName( name )
{
    for(var i = 0; i < scene.root.children.length; i++)
    {
        if(scene.root.children[i].name == name)
            scene.root.children[i].destroy();
    }
}

function findTexPath(fn)
{ 

    for(t in textures)
    {
        if(HDRTool.getName(textures[t].path) == HDRTool.getName(fn))
            return t;
    }
        
    return null;
}

function drawMatrix( em, visible )
{
    // remove previous
    removeByName( 'matrix_node' );
    var values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    var node = new RD.SceneNode();
    node.name = "matrix_node";
    node.flags.visible = visible;
    scene.root.addChild(node);

    for(var i = 0; i < 10; i++)
    {
        for(var j = 0; j < 10; j++)
        {
            var mn = new RD.SceneNode();
            mn.mesh = "sphere";
            mn.shader = "pbrMat";
            mn.position = [j*2,0,i*2];
            mn._uniforms["u_roughness"] = values[i];
            mn._uniforms["u_metalness"] = values[j];
            mn.textures['brdf'] = "_brdf_integrator";
            mn.textures['env'] = em;
            mn.textures['env_1'] = "_prem_0_"+em;
            mn.textures['env_2'] = "_prem_1_"+em;
            mn.textures['env_3'] = "_prem_2_"+em;
            mn.textures['env_4'] = "_prem_3_"+em;
            mn.textures['env_5'] = "_prem_4_"+em;
            node.addChild(mn);
        }
    }

    removeLoading();
}

function drawScale( em, visible, options )
{
    // remove previous
    removeByName( 'roughness_scale_node' );
    options = options || {};
    if(!options.property)
    throw( 'No property to make scale' );
    
    var prop = options.property;
    var name = (prop == 'roughness') ? 'roughness_scale_node' : 'metalness_scale_node';
    var aux_prop = options.aux_prop;

    var values = [1.0, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.0];
    var node = new RD.SceneNode();
    node.name = name;
    node.flags.visible = visible;
    scene.root.addChild(node);

    for(var i = 0; i < 9; i++)
    {
        var mn = new RD.SceneNode();
        mn.name = "child" + i;
        mn.mesh = "sphere";
        mn.position = [0,0,i*2];

        if(prop == 'roughness') {
            mn._uniforms["u_roughness"] = values[i];
            mn._uniforms["u_metalness"] = aux_prop != null ? aux_prop : 0.0;
        }
        else {
            mn._uniforms["u_roughness"] = aux_prop != null ? aux_prop : 1.0;
            mn._uniforms["u_metalness"] = values[i];
        }

        mn.textures['brdf'] = "_brdf_integrator";
        mn.textures['env'] = em;
        mn.textures['env_1'] = "_prem_0_" + em;
        mn.textures['env_2'] = "_prem_1_" + em;
        mn.textures['env_3'] = "_prem_2_" + em;
        mn.textures['env_4'] = "_prem_3_" + em;
        mn.textures['env_5'] = "_prem_4_" + em;
        mn.shader = "pbrMat";
        node.addChild( mn );
    }
    removeLoading();
}

// glow effect (litegraph.js @javiagenjo)
function getGlowTexture( tex, options )
{
    if(!tex)
        return;	

    var LGraphTextureGlow = LiteGraph.Nodes.LGraphTextureGlow;
    var properties = {
        intensity: options.intensity || 1,
        persistence: options.persistence || 0.99,
        iterations: options.iterations == undefined ? 8 : options.iterations,
        threshold: options.threshold == undefined ? 1 : options.threshold,
        scale: options.scale || 1,
        precision: options.precision || LGraphTexture.DEFAULT
    };

    var width = tex.width;
    var height = tex.height;

    var texture_info = { format: tex.format, type: tex.type, minFilter: GL.LINEAR, magFilter: GL.LINEAR, wrap: gl.CLAMP_TO_EDGE	};
    var type = LGraphTexture.getTextureType( properties.precision, tex );

    var uniforms = { u_intensity: 1, u_texture: 0, u_glow_texture: 1, u_threshold: 0, u_texel_size: vec2.create() };
    var textures = [];

    //cut
    var shader = LGraphTextureGlow._cut_shader;
    if(!shader)
        shader = LGraphTextureGlow._cut_shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureGlow.cut_pixel_shader );

    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );

    uniforms.u_threshold = properties.threshold;
    var currentDestination = textures[0] = GL.Texture.getTemporary( width, height, texture_info );
    tex.blit( currentDestination, shader.uniforms(uniforms) );
    var currentSource = currentDestination;

    var iterations = properties.iterations;
    iterations = Math.clamp( iterations, 1, 16) | 0;
    var texel_size = uniforms.u_texel_size;
    var intensity = properties.intensity;

    uniforms.u_intensity = 1;
    uniforms.u_delta = properties.scale; //1

    //downscale upscale shader
    var shader = LGraphTextureGlow._shader;
    if(!shader)
        shader = LGraphTextureGlow._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureGlow.scale_pixel_shader );

    var i = 1;
    //downscale
    for (;i < iterations; i++) {
        width = width>>1;
        if( (height|0) > 1 )
            height = height>>1;
        if( width < 2 )
            break;
        currentDestination = textures[i] = GL.Texture.getTemporary( width, height, texture_info );
        texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
        currentSource.blit( currentDestination, shader.uniforms(uniforms) );
        currentSource = currentDestination;
    }

    //average

    var average_texture = this._average_texture;
    if(!average_texture || average_texture.type != tex.type || average_texture.format != tex.format )
        average_texture = this._average_texture = new GL.Texture( 1, 1, { type: tex.type, format: tex.format, filter: gl.LINEAR });
    texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
    uniforms.u_intensity = intensity;
    uniforms.u_delta = 1;
    currentSource.blit( average_texture, shader.uniforms(uniforms) );
    window.average_texture = average_texture;// ?Â¿?Â¿?Â¿? 

    //upscale and blend 
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.ONE, gl.ONE );
    uniforms.u_intensity = properties.intensity;
    uniforms.u_delta = 0.5;

    for (i -= 2; i >= 0; i--) // i-=2 =>  -1 to point to last element in array, -1 to go to texture above
    { 
        currentDestination = textures[i];
        textures[i] = null;
        texel_size[0] = 1 / currentSource.width; texel_size[1] = 1 / currentSource.height;
        currentSource.blit( currentDestination, shader.uniforms(uniforms) );
        GL.Texture.releaseTemporary( currentSource );
        currentSource = currentDestination;
    }
    gl.disable( gl.BLEND );

    //glow
    var glow_texture = this._glow_texture;
    if(!glow_texture || glow_texture.width != tex.width || glow_texture.height != tex.height || glow_texture.type != type || glow_texture.format != tex.format )
        glow_texture = this._glow_texture = new GL.Texture( tex.width,  tex.height, { type: type, format: tex.format, filter: gl.LINEAR });
    currentSource.blit( glow_texture );

    //final composition
    var final_texture = this._final_texture;
    if(!final_texture || final_texture.width != tex.width || final_texture.height != tex.height || final_texture.type != type || final_texture.format != tex.format )
        final_texture = this._final_texture = new GL.Texture( tex.width, tex.height, { type: type, format: tex.format, filter: gl.LINEAR });

    uniforms.u_intensity = intensity;

    shader = LGraphTextureGlow._final_shader = renderer.shaders["glow"]; 

    final_texture.drawTo( function(){
        tex.bind(0);
        currentSource.bind(1);
        shader.toViewport( uniforms );
    });
    GL.Texture.releaseTemporary( currentSource );

    return final_texture; // ?Â¿?Â¿?Â¿?
}

function getAverage(tex)
{
    if(!tex)
        return;

    var LGraphTextureAverage = LiteGraph.Nodes.LGraphTextureAverage;

    var properties = { mipmap_offset: 0, low_precision: false };
    var _uniforms = { u_texture: 0, u_mipmap_offset: properties.mipmap_offset };
	var _luminance = new Float32Array(4);

    if(!LGraphTextureAverage._shader)
    {
        LGraphTextureAverage._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureAverage.pixel_shader);
        //creates 32 random numbers and stores the, in two mat4 
        var samples = new Float32Array(32);
        for(var i = 0; i < 32; ++i)	
            samples[i] = Math.random();
        LGraphTextureAverage._shader.uniforms({u_samples_a: samples.subarray(0,16), u_samples_b: samples.subarray(16,32) });
    }

    var _temp_texture = null;
    var type = gl.UNSIGNED_BYTE;
    if(tex.type != type) //force floats, half floats cannot be read with gl.readPixels
        type = gl.FLOAT;

    if(!_temp_texture || temp.type != type )
        _temp_texture = new GL.Texture( 1, 1, { type: type, format: gl.RGBA, filter: gl.NEAREST });

    var shader = LGraphTextureAverage._shader;
    var uniforms = _uniforms;
    uniforms.u_mipmap_offset = 0.0; ///////
    _temp_texture.drawTo(function(){
        tex.toViewport( shader, uniforms );
    });

    var pixel = _temp_texture.getPixels();
    if(pixel)
    {
        var v = _luminance;
        var type = _temp_texture.type;
        v.set( pixel );
        if(type == gl.UNSIGNED_BYTE)
            vec4.scale( v,v, 1/255 );
        else if(type == GL.HALF_FLOAT || type == GL.HALF_FLOAT_OES)
            vec4.scale( v,v, 1/(255*255) ); //is this correct?

        var val = (v[0] + v[1] + v[2]) / 3;
        return Math.clamp(val, 0.2, 1.0);
    }
}

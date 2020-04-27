/*
*   author: Alex Rodriguez
*   @jxarco 
*/

/**
* container for each of the render passes
* @class RenderPass
* @constructor
*/

function RenderComposer( renderer, camera )
{
    if(this.constructor !== RenderComposer)
        throw("Use new to create a RenderComposer");

    this._ctor(renderer, camera);
}

var RC = RenderComposer;

RC.DEFAULT  = 0;
RC.MULTIPLY = 1;

RC.QUALITY_DOWNSAMPLE   = 0;
RC.QUALITY_HIGH         = 1;

RC.COLOR_BUFFER     = 0;
RC.NORMAL_BUFFER    = 1;
RC.POSITION_BUFFER  = 2;
RC.DEPTH_BUFFER     = 3;

RC.FBO_INFO = [ "u_color_texture", "u_normal_texture", "u_position_texture", "u_depth_texture" ];

RenderComposer.prototype._ctor = function(renderer, camera)
{
    this.renderer = renderer;
    this.scene = renderer.current_scene;
    this.camera = camera;

    this.render_passes = [];
    this._info = {};
}

RenderComposer.prototype.preRender = function( fbo )
{
    var renderer = this.renderer;
    this.updateUniforms();

    // Fill Geometry buffers of the FBO
    fbo.bind(true);
        
    // Enable/disable WebGl flags
    gl.enable( gl.DEPTH_TEST );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // render geometry and capture info
    var nodes = CORE.getRenderableNodes();
    renderer.render( this.scene, this.camera, nodes );

    // Single channel draw instructions
    fbo.toSingle();

    if(CORE.gizmo)
        CORE.gizmo.renderOutline(this.renderer, this.scene, this.camera);
    
    // Render editor
    for(var i in this.scene.root.children)
    {
        var node = this.scene.root.children[i];

        if(!node.components)
            continue;
            
        for(var j in node.components)
        {
            if(node.components[j].renderEditor)
                node.components[j].renderEditor();
        }
    }

    // Restore fbo to multi channel
    fbo.toMulti();

    // Enable/disable WebGl flags
    gl.disable( gl.DEPTH_TEST );

    // unbind framebuffer object
    fbo.unbind();
}

RenderComposer.prototype.render = function( fbo )
{
    this.preRender( fbo );

    for( var i in this.render_passes )
    if(this.render_passes[i].enabled)
        this.render_passes[i].render( fbo );
}

RenderComposer.prototype.add = function( o )
{
    if( o.constructor !== RenderPass )
    throw("can't add pass: constructor is not RenderPass");

    o.composer = this;
    this.render_passes.push( o );
    
    if(o.name)
    {
        this._info[o.name] = o;
        
        Object.defineProperty(this, o.name, {
			get: function(){ return this._info[o.name];}
		});
    }
}

RenderComposer.prototype.updateUniforms = function()
{
    let inv_p = mat4.create(),
    inv_v = mat4.create(),
    inv_vp = mat4.create();

    mat4.invert(inv_p, this.camera._projection_matrix);
    mat4.invert(inv_v, this.camera._view_matrix);
    mat4.invert(inv_vp, this.camera._viewprojection_matrix);
    
    this.renderer._uniforms["u_invv"] = inv_v;
    this.renderer._uniforms['u_invp'] = inv_p;
    this.renderer._uniforms['u_invvp'] = inv_vp;
    this.renderer._uniforms['u_projection'] = this.camera._projection_matrix;
    this.renderer._uniforms['u_view'] = this.camera._view_matrix;
}

/**
* Render pass to the FBO color buffer
* @class RenderPass
* @constructor
*/

// TODO: Change this to ShaderPass -> renderPass is the composer preRender

function RenderPass( name, shader, textures, options )
{
    if(this.constructor !== RenderPass)
        throw("Use new to create a RenderPass");

    this._ctor(name, shader, textures, options);
}

Object.defineProperty(RenderPass.prototype, "qlt", {
    get: function(){ return this._qlt;},
    set: function(v){  

        if(v == RC.QUALITY_DOWNSAMPLE)
        {
            this.uniforms["u_downsampled"] = true;
            this.result = new GL.Texture((gl.canvas.width/4)|0, (gl.canvas.height/4)|0, this.outputOptions);
        }
        else
        {
            this.uniforms["u_downsampled"] = false;
            this.result = new GL.Texture((gl.canvas.width)|0, (gl.canvas.height)|0, this.outputOptions);
        }

        this._qlt = v;
    },
    enumerable: true
});

RenderPass.prototype._ctor = function( name, shader, textures, options )
{
    options = options || {};

    this.enabled = true;
    this.name = name;
    this.shader = shader;
    this.extra_textures = textures || [];
    
    this.outputOptions = { type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR };
    
    this.result = new GL.Texture((gl.canvas.width)|0, (gl.canvas.height)|0, this.outputOptions);
    this.uniforms = options.uniforms || {};
    this.onShaderPass = options.onShaderPass;
    this.type = options.type || RC.DEFAULT;
    this._qlt = RC.QUALITY_DOWNSAMPLE;

    if(this._qlt == RC.QUALITY_DOWNSAMPLE)
    {
        this.uniforms["u_downsampled"] = true;
        this.result = new GL.Texture((gl.canvas.width/4)|0, (gl.canvas.height/4)|0, this.outputOptions);
    }
    else
    {
        this.uniforms["u_downsampled"] = false;
        this.result = new GL.Texture((gl.canvas.width)|0, (gl.canvas.height)|0, this.outputOptions);
    }
}

RenderPass.prototype.setTextures = function(textures)
{
    this.extra_textures = textures || [];
}

RenderPass.prototype.setUniforms = function(uniforms)
{
    this.uniforms = uniforms || {};
}

RenderPass.prototype.render = function( fbo )
{
    if(!fbo || !this.shader)
    throw("missing fbo or shader for render pass");

    if(this.shader.constructor === String)
    this.shader = gl.shaders[ this.shader ];

    var fbo_textures = fbo.color_textures.concat( fbo.depth_texture ); // Color, normal, pos, depth
    var extra_textures = this.extra_textures; // Noise in case of SSAO
    var renderer = this.composer.renderer;
    var uniforms = Object.assign( {}, renderer._uniforms );
    Object.assign( uniforms, this.uniforms );

    // Bind G buffer textures
    var i = 0;
    for( ; i < fbo_textures.length; ++i ) {
        var buffer_name = RC.FBO_INFO[ i ];
        uniforms[ buffer_name ] = i;
        fbo_textures[i].bind(i);
    }

    // Bind the rest of textures
    for(var j = 0; j < extra_textures.length; ++j) {
        var buffer_name = extra_textures[j].name ? "u_" + extra_textures[j].name + "_texture" : "u_extra" + j + "_texture";
        var index = i+j;
        uniforms[ buffer_name ] = index;
        extra_textures[j].bind( index );
    }

    // Render result texture
    this.result.drawTo( (function(){

        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.disable( gl.DEPTH_TEST );
        gl.disable( gl.BLEND );

        this.shader.uniforms( uniforms ).draw( Mesh.getScreenQuad() );

    }).bind(this) );

    // Unbind All buffers
    for(var i = 0; i < fbo_textures.length; ++i )
    fbo_textures[i].unbind();

    for(var j = 0; j < extra_textures.length; ++j)
    extra_textures[j].unbind();

    // Apply additional steps to resulting texture or use : blur, glow, etc
    if(this.onShaderPass)
    this.onShaderPass( this.result );

    // Call final shader pass
    this.renderOutput( fbo );
}

RenderPass.prototype.renderOutput = function( fbo )
{
    var type = this.type;
    var color_texture = fbo.color_textures[ RC.COLOR_BUFFER ];
    var uniforms = Object.assign( {}, renderer._uniforms );
    Object.assign( uniforms, this.uniforms );

    switch (type) {
        case RC.DEFAULT:

            color_texture.drawTo( (function(){

                this.result.toViewport();

            }).bind(this) );

            break;

        case RC.MULTIPLY:
            
            if(!this.tmp)
            this.tmp = new GL.Texture((gl.canvas.width)|0, (gl.canvas.height)|0, { type: gl.FLOAT, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

            color_texture.bind(0);
            this.result.bind(1);
        
            uniforms['u_color_texture'] = 0;
            uniforms['u_output_texture' ] = 1;

            this.tmp.drawTo(function(){

                gl.shaders['multiplyPass'].uniforms( uniforms ).draw(Mesh.getScreenQuad());
            });

            color_texture.unbind();
            this.result.unbind();

            // draw to color buffer
            color_texture.drawTo( (function(){

                this.tmp.toViewport();

            }).bind(this) );
            
            break;
    }
}
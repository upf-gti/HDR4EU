/*
*   author: Alex Rodriguez
*   @jxarco 
*/

function LGraphSSAO()
{
    this.addInput("Frame","Array");
    this.addInput("Camera","Camera");

    this.addOutput("Texture","Texture");
    this.addOutput("ssao","Texture");
    
    this.size[0] = 150;
    this.properties = {
        enable: false,
        blur: true,
        radius: 1.25,
        bias: 0.025,
        max_dist: 5,
        min_dist: 0.025
    };

    this.kernelSize = 64;
	this.kernel = [];
    this.noiseSize = 4;
    this.noise = [];
    this.noiseTexture = null;
    
    this.generateSampleKernel();
    this.generateNoiseTexture();
}

LGraphSSAO.title = "SSAO";
LGraphSSAO.FBO_INFO = [ "u_color_texture", "u_normal_texture", "u_depth_texture", "u_position_texture" ];

LGraphSSAO.prototype.getShader = function()
{
    if (this.shader)
        return this.shader;

    this.shader = new GL.Shader(GL.Shader.SCREEN_VERTEX_SHADER, LGraphSSAO.frag_shader);

    if (!this.shader) {
        this.boxcolor = "red";
        return null;
    } else {
        this.boxcolor = "green";
    }
    return this.shader;
};

LGraphSSAO.prototype.onExecute = function()
{
    if(!this.isAnyOutputConnected())
    return;

    var num_buffers = 4;
    var shader = this.getShader();
    var fbo_textures = this.getInputDataByName("Frame"); // Color, normal, pos, depth
    var camera = this.getInputDataByName("Camera");
    var uniforms = {
        u_samples: GL.linearizeArray(this.kernel),
        u_radius: this.properties.radius,
        u_bias: this.properties.bias,
        u_max_dist: this.properties.max_dist,
        u_min_dist: this.properties.min_dist
    };

    if( !this.properties.enable)
    {
        this.setOutputData(0, fbo_textures[0] );
        return;
    }

    if(!camera || !fbo_textures || fbo_textures.length !== 4)
    return;

    // Bind G buffer textures
    var i = 0;
    for( ; i < num_buffers; ++i ) {

        var buffer_name = LGraphSSAO.FBO_INFO[ i ];
        uniforms[ buffer_name ] = i;
        fbo_textures[i].bind(i);
    }

    this.noiseTexture.bind( i );
    uniforms[ "u_noise_texture" ] = i;

    if ( !this.result ) {
        this.result = LGraphTexture.getTargetTexture( fbo_textures[0],  this.result, LGraphTexture.COPY );
    }

    uniforms['u_projection'] = camera._projection_matrix;
    uniforms['u_resolution'] = vec2.fromValues(this.result.width, this.result.height);
    uniforms["u_near"] = camera.near;
    uniforms["u_far"] = camera.far;

    // Render result texture
    this.result.drawTo( (function(){

        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.disable( gl.DEPTH_TEST );
        gl.disable( gl.BLEND );

        this.shader.uniforms( uniforms ).draw( Mesh.getScreenQuad() );

    }).bind(this) );

    // Unbind All buffers
    for(var i = 0; i < num_buffers; ++i )
    fbo_textures[i].unbind();

    this.noiseTexture.unbind();

    // Apply additional fx to resulting texture
    if( this.properties.blur )
        this.result.applyBlur( 0.5, 0.5 , 1);

    // Apply ssao to color texture
    var color_buffer = fbo_textures[0];

    this.setOutputData(0, this.apply( color_buffer, this.result ) );
    this.setOutputData(1, this.result );
}

LGraphSSAO.prototype.apply = function( tex, texB )
{
    if (!tex || !texB) {
        return;
    }

    var width = 512;
    var height = 512;
    if (tex) {
        width = tex.width;
        height = tex.height;
    } else if (texB) {
        width = texB.width;
        height = texB.height;
    }

    if (!this._tex ||
        this._tex.width != tex.width ||
        this._tex.height != tex.height
    ) 
        this._tex = LGraphTexture.getTargetTexture( tex, this._tex);

    var shader = this.apply_shader;

    if(!shader)
    {
        this.apply_shader = new GL.Shader(GL.Shader.SCREEN_VERTEX_SHADER, LGraphSSAO.mul_ssao_frag);
        shader = this.apply_shader;
    }

    this._tex.drawTo(function() {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        if (tex) {
            tex.bind(0);
        }
        if (texB) {
            texB.bind(1);
        }
        var mesh = Mesh.getScreenQuad();
        shader.uniforms({
            u_texture: 0,
            u_textureB: 1,
            texSize: [width, height]
        })
        .draw(mesh);
            
    });

    return this._tex;
};

LGraphSSAO.prototype.generateSampleKernel = function()
{
    this.kernelSize.length = 0;

    for (var i = 0; i < this.kernelSize; i++)
    {
        var sample = vec3.create();
        sample[0] = (Math.random() * 2) - 1;    // -1 to 1
        sample[1] = (Math.random() * 2) - 1;    // -1 to 1
        sample[2] = Math.random();              // 0 to 1  -> hemisphere
        
        sample = vec3.normalize(sample, sample);
        sample = vec3.scale(sample, sample, Math.random());

        // give more weights to closer samples 
        var scale = i / this.kernelSize;
        scale = lerp(0.1, 1.0, scale * scale);
        sample = vec3.scale(sample, sample, scale);

        this.kernel.push( sample );
    }
}

LGraphSSAO.prototype.generateNoiseTexture = function()
{
    var size = this.noiseSize * this.noiseSize;
    
    for (var i = 0; i < size; i++)
    {
        var n = vec3.create();
        n[0] = (Math.random());             // -1 to 1 -> transform in shader
        n[1] = (Math.random());             // -1 to 1 -> transform in shader
        n[2] = 0;                          // 0 rotate around Z
        
        this.noise.push( n );
    }

    // generate pixel data for noise texture

    var data = new Float32Array(size * 3);

    for (var i = 0; i < size; ++i)
    {
        var k = i*3;
        data[k++] = this.noise[i][0];
        data[k++] = this.noise[i][1];
        data[k++] = this.noise[i][2];
    }

    var options = {
        type: GL.FLOAT,
        format: GL.RGB,
        pixel_data: data,
        filter: gl.NEAREST,
        wrap: gl.REPEAT,
        anisotropic: 1
    }

    this.noiseTexture = new GL.Texture(this.noiseSize, this.noiseSize, options);
}

LGraphSSAO.frag_shader = `

    #extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
	uniform mat4 u_projection;
	uniform float u_near;
	uniform float u_far;

	uniform sampler2D u_color_texture;
	uniform sampler2D u_position_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_depth_texture;
	uniform sampler2D u_noise_texture;

    uniform vec2 u_resolution;
	uniform vec3 u_samples[64];
	uniform float u_radius;
	uniform float u_bias;
	uniform float u_max_dist;
	uniform float u_min_dist;

	varying vec2 v_coord;

	float readDepth(sampler2D depthMap, vec2 coord) {
		float z_b = texture2D(depthMap, coord).r;
		float z_n = 2.0 * z_b - 1.0;
		float z_e = 2.0 * u_near * u_far / (u_far + u_near - z_n * (u_far - u_near));
		return z_e;
	}

	vec2 viewSpaceToScreenSpaceTexCoord(vec3 p) {
		vec4 projectedPos = u_projection * vec4(p, 1.0);
		vec2 ndcPos = projectedPos.xy / projectedPos.w; //normalized device coordinates
		vec2 coord = ndcPos * 0.5 + 0.5;
		return coord;
	}

	void main() {
		
		vec4 colorMap = texture2D( u_color_texture, v_coord );
		vec4 depthMap = texture2D( u_depth_texture, v_coord);
		vec4 normalMap = texture2D( u_normal_texture, v_coord);
		vec3 normal    = normalize(normalMap.xyz * 2. - 1.);
		vec4 positionMap = texture2D( u_position_texture, v_coord);
        vec3 position = positionMap.xyz;
        float depth = readDepth(u_depth_texture, v_coord);

        float width = u_resolution[0];
        float height = u_resolution[1];

		vec2 noiseScale = vec2(width/4.0, height/4.0); 
		vec3 randomVec = texture2D(u_noise_texture, v_coord * noiseScale).xyz * 2.0 - vec3(1.0);
		vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
		vec3 bitangent = cross(normal, tangent);
		mat3 TBN       = mat3(tangent, bitangent, normal);  

		float radius = u_radius;
		float bias = u_bias;
		float occlusion = 0.0;

		for(int i = 0; i < 64; ++i)
		{
			vec3 sample = TBN * u_samples[i]; // From tangent to view-space
			sample = position + sample * radius;
			
			// transform to screen space 
			vec2 offset = viewSpaceToScreenSpaceTexCoord(sample);
			float sampleDepth = readDepth(u_depth_texture, offset);

			/*if( abs( (-sample.z) - sampleDepth ) > u_max_dist )
			continue;

			if( abs( (-sample.z) - sampleDepth ) < u_min_dist )
			continue;*/

			float rangeCheck =  smoothstep(0.0, 1.0, radius / abs((-sample.z) - sampleDepth));
  			occlusion += (sampleDepth <= -sample.z ? 1.0 : 0.0) * rangeCheck;
		} 

		occlusion = 1.0 - (occlusion / 64.0);
		gl_FragColor = vec4(vec3(occlusion), 1.0);
	}
`;

LGraphSSAO.mul_ssao_frag = 
    "precision highp float;\n\
    \n\
    uniform sampler2D u_texture;\n\
    uniform sampler2D u_textureB;\n\
    varying vec2 v_coord;\n\
    uniform vec2 texSize;\n\
    \n\
    void main() {\n\
        vec2 uv = v_coord;\n\
        vec4 color4 = texture2D(u_texture, uv);\n\
        vec3 color = color4.rgb;\n\
        vec4 color4B = texture2D(u_textureB, uv);\n\
        vec3 colorB = color4B.rgb;\n\
        vec3 result = color * colorB;\n\
        float alpha = 1.0;\n\
        gl_FragColor = vec4(result, alpha);\n\
    }\n\
    ";

LiteGraph.registerNodeType("fx/ssao", LGraphSSAO);
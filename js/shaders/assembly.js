/*
*   Alex Rodríguez
*   @jxarco 
*/

function HDRAssembly_Shader()
{
    if(this.constructor !== HDRAssembly_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( HDRAssembly_Shader.prototype, {

    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();
		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = '\tprecision highp float;\n';
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += HDRAssembly_Shader.VS_CODE;
		this.fs_code += HDRAssembly_Shader.FS_CODE;
	}
} );

HDRAssembly_Shader.VS_CODE = `

	attribute vec2 a_coord;
	varying vec2 v_coord;

	void main() {
		v_coord = a_coord;
		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
	}
`;

HDRAssembly_Shader.FS_CODE = `
	
	varying vec2 v_coord;
	uniform int u_numImages;
	// uniform sampler2D u_stack[4]; // not supported yet
	uniform sampler2D u_stack0;
	uniform sampler2D u_stack1;
	uniform sampler2D u_stack2;
	uniform sampler2D u_stack3;
	uniform sampler2D u_stack4;
	uniform sampler2D u_stack5;
	uniform sampler2D u_stack6;
	uniform sampler2D u_stack7;
	uniform sampler2D u_stack8;
	uniform sampler2D u_stack9;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}

	float weight( float value ){
		
		if(value <= 128.0)
			return value * 2.0;
		else
			return (1.0 - value) * 2.0;
	}

	void main() {

		int refId = u_numImages - 1;

		float weightSum = 0.0;
		vec4 hdr = vec4(0.0);

		vec3 samplers[16]; 
		samplers[0] = texture2D( u_stack0, v_coord ).rgb;
		samplers[1] = texture2D( u_stack1, v_coord ).rgb;
		samplers[2] = texture2D( u_stack2, v_coord ).rgb;
		samplers[3] = texture2D( u_stack3, v_coord ).rgb;
		samplers[4] = texture2D( u_stack4, v_coord ).rgb;
		samplers[5] = texture2D( u_stack5, v_coord ).rgb;
		samplers[6] = texture2D( u_stack6, v_coord ).rgb;
		samplers[7] = texture2D( u_stack7, v_coord ).rgb;
		samplers[8] = texture2D( u_stack8, v_coord ).rgb;
		samplers[9] = texture2D( u_stack9, v_coord ).rgb;

		for( int i = 0; i < 16; i++ )
		{
			if( i < u_numImages )
			{
				vec3 ldr = samplers[i];
				float lum = luminance( ldr );
				float w = weight( lum );
				float exposure = pow(2.0, float(i - refId));
				
				hdr.rgb += (ldr/exposure) * w;
				weightSum += w;
			}
		}

		hdr.rgb /= (weightSum + 1e-6);
		hdr.a = log(luminance(hdr.rgb) + 1e-6);
		gl_FragColor = hdr;
	}
`;

RM.registerShader( HDRAssembly_Shader, "HDRassembly" );
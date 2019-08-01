/*
*   Alex Rodríguez
*   @jxarco 
*/

function PBR_Shader_Deferred()
{
	if(this.constructor !== PBR_Shader_Deferred)
        throw("Use new");

	this.defines = {
		GAMMA: 2.2,
		PI: 3.14159265359,
		RECIPROCAL_PI: 0.3183098861837697,

		MAX_REFLECTANCE: 0.16,
		MIN_REFLECTANCE: 0.04,

		MIN_ROUGHNESS: 0.002025,
		MIN_PERCEPTUAL_ROUGHNESS: 0.045,
		MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS: 0.6
	};

	this.uniforms = {};
}   

Object.assign( PBR_Shader_Deferred.prototype, {

	info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(console) {

		if(console)
			this.info();
		this.vs_code = [
			'\tprecision highp float;\n'
		].join('\n');
		this.fs_code = [
			'\t#extension GL_EXT_draw_buffers : require',
			'\t#extension GL_OES_standard_derivatives : enable',
			'\tprecision highp float;\n'
		].join('\n');
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += PBR_Shader.VS_CODE;
		this.fs_code += PBR_Shader.FS_CODE; // same algorithm
		this.fs_code += PBR_Shader_Deferred.FS_MAIN_CODE;
	}
} );

PBR_Shader_Deferred.FS_MAIN_CODE = `

	void main() {
        
		PBRMat material;
		vec3 color;
		float alpha = u_alpha;

		createMaterial( material );
		do_lighting( material, color);

		if(u_hasAlpha)
			alpha = texture2D(u_opacity_texture, v_coord).r;

		if(u_isEmissive)
			 color += texture2D(u_emissive_texture, v_coord).rgb * u_emissiveScale;
		  
		/*
		if(u_show_layers)
		{
			const int channels = 6; // 5: add one extra for limits
			float x = (gl_FragCoord.x / u_viewport.z);
			float y = (gl_FragCoord.y / u_viewport.w);

			for( int i = 0; i < channels; i++ )
			{
				float f = float(i)/float(channels) + (0.765 - float(channels)/10.0)*y;
				if(x > f){
					if(i == 0)
						 color *= 1.0;
					else if(i == 1)
						color = vec3(material.roughness);
					else if(i == 2)
						color = vec3(material.metallic);
					else if(i == 3)
						color = material.N;
					else if(i == 4)
						color = vec3(material.linearRoughness);
					else if(i == 5)
						color *= 1.0;
				}
			}
		}*/
        
		gl_FragData[0] = vec4(color, alpha);
		gl_FragData[1] = vec4((material.N * 0.5 + vec3(0.5) ), 1.0); 
		gl_FragData[2] = vec4(vec3(material.roughness), 1.0);
		
    }
`;


RM.registerShader( PBR_Shader_Deferred, "pbr_deferred" );
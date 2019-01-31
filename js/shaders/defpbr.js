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

		MIN_ROUGHNESS: 0.01
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
		this.fs_code += PBR_Shader.FS_MAIN_CODE_DEFERRED; // color stored diff
	}
} );

RM.registerShader( PBR_Shader_Deferred, "pbr_deferred" );
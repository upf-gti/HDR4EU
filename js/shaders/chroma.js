/*
*   Alex Rodr�guez
*   @jxarco 
*/

function Chroma_Shader()
{
    if(this.constructor !== Chroma_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Chroma_Shader.prototype, {

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
		
		this.vs_code += Chroma_Shader.VS_CODE;
		this.fs_code += Chroma_Shader.FS_CODE;
	}
} );

Chroma_Shader.VS_CODE = `
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform mat4 u_mvp;
	uniform mat4 u_model;
	uniform mat4 u_normal_model;
	uniform mat4 u_view;

	void main() {
		
		vec4 vertex4 = vec4(a_vertex,1.0);
		vec4 normal4 = vec4(a_normal,0.0);
		v_wNormal = a_normal;
		v_coord = a_coord;

		//vertex
		v_wPosition = (u_model * vertex4).xyz;
		//normal
		v_wNormal = (u_model * normal4).xyz;

		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
	}
`;

Chroma_Shader.FS_CODE = `
	
	varying vec2 v_coord;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;

	uniform sampler2D u_chroma_texture;
	uniform float u_balance;
	uniform vec4 u_key_color;
	uniform vec4 u_fake_bounce;
	uniform float u_luminance_mask_power;
	uniform float u_despill_amount;
	uniform float _despill_threshold;
	uniform bool u_enable_despill;
	uniform bool u_enable_chroma;

	const float PI = 3.14159265359; 

	float Desaturate(vec3 color)
	{
		vec3 grayXfer = vec3(0.3, 0.59, 0.11);
		return dot(grayXfer, color);
	}

	vec3 extractColor(vec3 Color, float LumaMask){
	  
		float Luma = dot(Color, vec3(1.0));
		float ColorMask = exp((-Luma * 2.0 * PI * LumaMask) );
	  Color = mix( Color, vec3(Luma), ColorMask);
		return Color / (dot(Color, vec3(1.0)));
	}

	void main() {

		// https://www.unrealengine.com/en-US/tech-blog/setting-up-a-chroma-key-material-in-ue4

		// Color extraction

		vec3 source = texture2D(u_chroma_texture, v_coord).rgb;

		if(!u_enable_chroma)
		{
			gl_FragColor = vec4(vec3(source), 1.0);
			return;
		}

		vec4 screen = u_key_color;

		float fmin_key = min(min(screen.r, screen.g), screen.b); //Min. value of RGB	
		float fmax_key = max(max(screen.r, screen.g), screen.b); //Max. value of RGB

		vec3 screenPrimary = step(fmax_key, screen.rgb);
		float secondaryComponents_key = dot(1.0 - screenPrimary, screen.rgb);
		float screenSat = fmax_key - mix(secondaryComponents_key - fmin_key, secondaryComponents_key / 2.0, u_balance);

		float fmin = min(min(source.r, source.g), source.b); //Min. value of RGB
		float fmax = max(max(source.r, source.g), source.b); //Max. value of RGB

		vec3 pixelPrimary = step(fmax, source.rgb);

		// remove green pixels with little contribution
		if(fmax < min(_despill_threshold, 0.95))
			pixelPrimary = vec3(0, 0, 1);

		float secondaryComponents = dot(1.0 - pixelPrimary, source.rgb); 
		float pixelSat = fmax - mix(secondaryComponents - fmin, secondaryComponents / 2.0, u_balance); // Saturation

		// solid pixel if primary color component is not the same as the screen color
		float diffPrimary = dot(abs(pixelPrimary - screenPrimary), vec3(1.0));
		float alpha = 1.0 - ((1.0 - diffPrimary) * smoothstep(0.0, 0.25, pixelSat) * smoothstep(0.1, 0.2, pixelSat));
		//float alpha = step(1.0, step(pixelSat, 0.1) + step(fmax, 0.33) + diffPrimary);

		vec3 chromaColor = extractColor(screenPrimary.rgb, u_luminance_mask_power);
		vec4 ColorExtraction = vec4(source, alpha);

		// Despill

		vec3 finalColor = ColorExtraction.rgb;
		float despillMask;
		vec3 test;

		if(u_enable_despill) {

			despillMask = (1.0 - diffPrimary) * smoothstep(0.0, 0.1, pixelSat);
			despillMask = clamp(despillMask, 0.0, 1.0);

			//finalColor.g *= (1.0 - smoothstep(0.0, 2.0, despillMask));

			finalColor -= (chromaColor.rgb * screen.rgb * despillMask * u_despill_amount);
			finalColor += (pixelSat * u_fake_bounce.rgb * despillMask * u_despill_amount);   
			finalColor = clamp(finalColor, 0.0, 1.0);

		}

		gl_FragColor = vec4(vec3(v_wNormal), alpha);
	}
`;

// RM.registerShader( Chroma_Shader, "chroma" );

function Silhouette_Shader()
{
    if(this.constructor !== Silhouette_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( Silhouette_Shader.prototype, {

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
		
		this.vs_code += Silhouette_Shader.VS_CODE;
		this.fs_code += Silhouette_Shader.FS_CODE;
	}
} );

Silhouette_Shader.VS_CODE = `
	
		attribute vec2 a_coord;

		//varyings
		varying vec2 v_coord;

		void main() {
			
			v_coord = a_coord;
			gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
		}
`;

Silhouette_Shader.FS_CODE = `
	
	//varyings
	varying vec2 v_coord;

	//globals
	uniform sampler2D u_chroma_texture;

	void main() {

		// Color extraction

		vec3 source = texture2D(u_chroma_texture, v_coord).rgb;

		vec4 screen = vec4(0.0, 1.0, 0.0, 1.0);
		float balance = 0.0;

		float fmin_key = min(min(screen.r, screen.g), screen.b); //Min. value of RGB	
		float fmax_key = max(max(screen.r, screen.g), screen.b); //Max. value of RGB

		vec3 screenPrimary = step(fmax_key, screen.rgb);
		float secondaryComponents_key = dot(1.0 - screenPrimary, screen.rgb);
		float screenSat = fmax_key - mix(secondaryComponents_key - fmin_key, secondaryComponents_key / 2.0, balance);

		float fmin = min(min(source.r, source.g), source.b); //Min. value of RGB
		float fmax = max(max(source.r, source.g), source.b); //Max. value of RGB

		vec3 pixelPrimary = step(fmax, source.rgb);

		float secondaryComponents = dot(1.0 - pixelPrimary, source.rgb); 
		float pixelSat = fmax - mix(secondaryComponents - fmin, secondaryComponents / 2.0, balance); // Saturation

		// solid pixel if primary color component is not the same as the screen color
		float diffPrimary = dot(abs(pixelPrimary - screenPrimary), vec3(1.0));
		float alpha = 1.0 - ((1.0 - diffPrimary) * smoothstep(0.0, 0.25, pixelSat) * smoothstep(0.1, 0.2, pixelSat));
	
		vec3 finalColor = vec3(1.0);
		if(alpha < 0.75)
		finalColor = vec3(0.0);


		gl_FragColor = vec4(vec3(finalColor), 1.0);
	}
`;

RM.registerShader( Silhouette_Shader, "silhouette" );

function NormalGenerator_Shader()
{
    if(this.constructor !== NormalGenerator_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( NormalGenerator_Shader.prototype, {

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
		
		this.vs_code += NormalGenerator_Shader.VS_CODE;
		this.fs_code += NormalGenerator_Shader.FS_CODE;
	}
} );

NormalGenerator_Shader.VS_CODE = `
		attribute vec2 a_coord;
		varying vec2 v_coord;
		
		void main() {
			v_coord = a_coord;
			gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
		}
`;

NormalGenerator_Shader.FS_CODE = `
	
	//varyings
	varying vec2 v_coord;

	//globals
	uniform sampler2D u_texture;
	uniform vec2 u_size;
	uniform float u_strength;

	vec3 ComputeNormals(vec2 uv) {

		vec2 textureSize = u_size;
		vec2 texelSize =  vec2(1.0) / textureSize;
		float normalStrength = u_strength;

		float tl = abs(texture2D (u_texture, uv + texelSize * vec2(-1., -1.)).x);   // top left
		float  l = abs(texture2D (u_texture, uv + texelSize * vec2(-1.,  0.)).x);   // left
		float bl = abs(texture2D (u_texture, uv + texelSize * vec2(-1.,  1)).x);   // bottom left
		float  t = abs(texture2D (u_texture, uv + texelSize * vec2( 0., -1.)).x);   // top
		float  b = abs(texture2D (u_texture, uv + texelSize * vec2( 0.,  1.)).x);   // bottom
		float tr = abs(texture2D (u_texture, uv + texelSize * vec2( 1., -1.)).x);   // top right
		float  r = abs(texture2D (u_texture, uv + texelSize * vec2( 1.,  0.)).x);   // right
		float br = abs(texture2D (u_texture, uv + texelSize * vec2( 1.,  1.)).x);   // bottom right
	 
		// Compute dx using Sobel:
		//           -1.0 1 
		//           -2 0 2
		//           -1 0 1
		float dX = tr + 2.*r + br -tl - 2.*l - bl;
	 
		// Compute dy using Sobel:
		//           -1 -2 -1 
		//            0  0  0
		//            1  2  1
		float dY = bl + 2.*b + br -tl - 2.*t - tr;
	 
		// Build the normalized normal
		vec3 normal = vec3(dX, - dY,  1.0 / normalStrength);
		normal = normalize(normal) * 0.5 + vec3(0.5);

		//convert (-1.0 , 1.0) to (0.0 , 1.0), if needed
		return normal;
	}

	void main() {

		// http://www.catalinzima.com/2008/01/converting-displacement-maps-into-normal-maps/

		vec3 color = ComputeNormals(v_coord);
		gl_FragColor = vec4(color, 1.0);
	}
`;

RM.registerShader( NormalGenerator_Shader, "generate_normal" );

function AddTextureColor_Shader()
{
    if(this.constructor !== AddTextureColor_Shader)
        throw("Use new");

	this.defines = {};
	this.uniforms = {};
}   

Object.assign( AddTextureColor_Shader.prototype, {

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
		
		this.vs_code += AddTextureColor_Shader.VS_CODE;
		this.fs_code += AddTextureColor_Shader.FS_CODE;
	}
} );

AddTextureColor_Shader.VS_CODE = `
		attribute vec2 a_coord;
		varying vec2 v_coord;
		
		void main() {
			v_coord = a_coord;
			gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
		}
`;

AddTextureColor_Shader.FS_CODE = `
	
	//varyings
	varying vec2 v_coord;

	//globals
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_color;

	uniform float u_factor;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}

	void main() {

		vec4 color = texture2D(u_texture, v_coord);
		color *= luminance(texture2D(u_texture_color, v_coord).rgb) * u_factor;
		gl_FragColor = color;
	}
`;

RM.registerShader( AddTextureColor_Shader, "add_color_texture" );
\shaders

fbo_flat default.vs default.fs

// Basic shaders
textured default.vs textured.fs
webcam default.vs webcam.fs
textured_phong default.vs textured_phong.fs
flipY screen_shader.vs flipY.fs
basicFx screen_shader.vs basicFx.fs
grid default.vs grid.fs
lines default.vs lines.fs

skinning skinning.vs skinning.fs

// HDRI
HDRassembly screen_shader.vs HDRassembly.fs
combineHDR screen_shader.vs combineHDR.fs
assemblyViewer screen_shader.vs assemblyViewer.fs

NoneHDRI QUAD_VERTEX_SHADER.vs NoneHDRI.fs
TestHDRI QUAD_VERTEX_SHADER.vs TestHDRI.fs
ExponentialHDRI QUAD_VERTEX_SHADER.vs ExponentialHDRI.fs
PTR_HDRI QUAD_VERTEX_SHADER.vs PTR_HDRI.fs

// Cubemap shaders
skybox default.vs skybox.fs
sphereMap default.vs sphereMap.fs

// Cubemap FX Shaders
blur blur.vs blur.fs
defblur defblur.vs defblur.fs
CMFT defblur.vs CMFT.fs
mirror default.vs mirroredSphere.fs
diffCubemap screen_shader.vs diffCubemap.fs

// Texture FX Shaders
chroma chroma.vs chroma.fs
maxLum screen_shader.vs maxLum.fs
luminance screen_shader.vs luminance.fs
workflow_wrap screen_shader.vs workflow_wrap.fs

// Deferred rendering Shaders
ssao screen_shader.vs ssao.fs
ssr screen_shader.vs ssr.fs
multiplyPass screen_shader.vs multiplyPass.fs
toLinear screen_shader.vs toLinear.fs

// why i was using this before?
linearDepth screen_shader.vs linearDepth.fs 

// PBR and SH
pbr pbr.vs pbr.fs
pbr_light screen_shader.vs pbr_light.fs
pbr_sh SH.vs SH.fs

\HDRassembly.fs

	precision highp float;
	varying vec2 v_coord;

	uniform float 	u_ExposureTimes[16];
	uniform vec4 	u_WhiteBalance[16];
	uniform float 	u_hdr_scale;
	uniform int 	u_numImages;

	uniform sampler2D u_stack0;
	uniform sampler2D u_stack1;
	uniform sampler2D u_stack2;
	uniform sampler2D u_stack3;
	uniform sampler2D u_stack4;
	uniform sampler2D u_stack5;
	uniform sampler2D u_stack6;
	uniform sampler2D u_stack7;
	uniform sampler2D u_stack8;

	void fillSamplers( inout vec4 samplers[16] )
	{
		samplers[0] = texture2D( u_stack0, v_coord );
		samplers[1] = texture2D( u_stack1, v_coord );
		samplers[2] = texture2D( u_stack2, v_coord );
		samplers[3] = texture2D( u_stack3, v_coord );
		samplers[4] = texture2D( u_stack4, v_coord );
		samplers[5] = texture2D( u_stack5, v_coord );
		samplers[6] = texture2D( u_stack6, v_coord );
		samplers[7] = texture2D( u_stack7, v_coord );
		samplers[8] = texture2D( u_stack8, v_coord );
	}

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}

	float Compute_Weight( float value ){
		
		float f;
		if(value <= 0.5)
		f = value;
		else
		f = 1.0 - value;
		return 2.0 * f;
	}

	float Cweight(float  value) {
		
		const float blacklevel = 0.;
		const float saturation = 16383.;

		const float alpha = -1.0 / 1e10;
		const float beta = 1.0 / exp(4.0 * alpha);

		float scaled = (value - blacklevel) / (saturation - blacklevel);

		if (scaled <= 0. || scaled >= 1.)
			return 0.;

		return beta * exp(alpha * (1./scaled + 1./(1.-scaled)));
	}

	void main() {

		float PixelWeightSum 		= 0.0;
		vec4 ChannelWeightSum 		= vec4(0.0);

		vec4 hdr 		= vec4(0.0);
		int refId 		= int(float(u_numImages) / 2.0);
		
		bool preGamma 	= false;
		bool postGamma 	= true;

		bool UsePerChannelWeights = false;

		vec4 samplers[16]; 
		fillSamplers(samplers);

		for( int i = 0; i < 16; i++ )
		{
			if( i < u_numImages )
			{
				float refIdExp = pow(2.0, float(i - refId));
				float ExpTime = u_ExposureTimes[i];
				
				vec4 pixelLdr = pow(samplers[i], preGamma ? vec4(1.0/2.2) : vec4(1.0));

				// white balance
				//pixelLdr *= u_WhiteBalance[i];
				//pixelLdr = clamp(pixelLdr, vec4(0.0), vec4(1.0) );

				float lum = luminance( pixelLdr.rgb );
				
				// Per pixel
				float PixelWeight = ExpTime * Compute_Weight( lum ) + 1e-6;
				
				// Per channel
				float RedWeight = ExpTime * Compute_Weight( pixelLdr.r ) + 1e-6;
				float GreenWeight = ExpTime * Compute_Weight( pixelLdr.g ) + 1e-6;
				float BlueWeight = ExpTime * Compute_Weight( pixelLdr.b ) + 1e-6;

				if(!UsePerChannelWeights)
				{
					float W = PixelWeight;
					hdr += pixelLdr * W;
					PixelWeightSum += W;
				}
				else
				{
					vec4 W = vec4(RedWeight, GreenWeight, BlueWeight, 1.0);
					hdr += pixelLdr * W;
					ChannelWeightSum += W;
				}
			}
		}

		if(!UsePerChannelWeights)
			hdr /= (PixelWeightSum + 1e-6);
		else
			hdr /= (ChannelWeightSum + vec4(1e-6));

		// convert to hdr
		vec3 _HDR = hdr.rgb * pow(vec3(2.), vec3(u_hdr_scale));

		// get pixel luminance
		float logLum = log(luminance(_HDR) + 1e-6);
		
		//hdr.rgb *= pow(vec3(2.), vec3(u_hdr_scale));

		gl_FragColor = vec4(_HDR, logLum);
	}

//
// Default vertex shader 
//


\default.vs

	precision mediump float;
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
		gl_Position = u_mvp * vec4(a_vertex,1.0);
	}

\default.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	void main() {

		//gl_FragColor = u_color;
		gl_FragData[0] = u_color;
	}

\textured.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform vec4 u_color;
	uniform sampler2D u_albedo_texture;

	void main() {

		vec4 color = texture2D(u_albedo_texture, v_coord);

		// Undo the gamma correction in the previous render step
		color.rgb = pow(color.rgb, vec3(2.2));

		gl_FragData[0] = color;
	}

\webcam.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform sampler2D u_color_texture;

	void main() {

		vec4 color = texture2D(u_color_texture, v_coord);

		// Undo the gamma correction in the previous render step
		color.rgb = pow(color.rgb, vec3(2.2));

		gl_FragData[0] = color;
	}

\textured_phong.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform vec3 u_camera_position;
	uniform vec3 u_lightcolor;
	uniform vec3 u_lightvector;
	uniform vec4 u_color;
	
	uniform float u_diffuse_power;
	uniform float u_specular_power;
	uniform float u_specular_gloss;
	uniform float u_reflectivity;
	uniform vec3 u_ambient;

	uniform sampler2D u_albedo_texture;
	uniform samplerCube u_SpecularEnvSampler_texture;

	void applyReflection(vec3 R, inout vec4 color)
	{
		float ref_factor = pow(u_reflectivity, 3.0);
		vec3 bg = textureCubeLodEXT(u_SpecularEnvSampler_texture, R, 0.0).rgb;
		color.xyz = mix( color.xyz, bg, clamp( ref_factor, 0.0, 0.98) );
	}

	void main() {
		
		vec3 N = normalize(v_wNormal);
		vec3 ambient = u_ambient;

		// vec3 L = u_lightvector; 
		vec3 L_pos = vec3(3., 3., 0.);
		vec3 L = normalize(L_pos - v_wPosition);

		// vec3 Lcolor = u_lightcolor; 
		vec3 Lcolor = vec3(1.0);

		vec3 V = normalize(u_camera_position - v_wPosition);
		vec3 R_view = reflect(V, N);  
		vec3 R = reflect(-L, N);  

		float NdotL = max(0.0, dot(L,N));
		float RdotV = max(0.0, dot(R,V));

		vec3 Diffuse = vec3(abs(NdotL)) * u_diffuse_power;
		vec3 Specular =  vec3(pow(abs(RdotV), u_specular_gloss)) * u_specular_power;

		vec4 material_color = u_color * texture2D(u_albedo_texture, v_coord);
		vec4 color = material_color * vec4(ambient + Diffuse + Specular, 1.0);

		if(u_reflectivity > 0.0)
			applyReflection(R_view, color);

		//gl_FragColor = vec4(color.rgb, 1.0);
		gl_FragData[0] = vec4(color.rgb, 1.0);
	}

\flipY.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	uniform sampler2D u_color_texture;

	void main() {

		vec2 coord = vec2( v_coord.x, 1.0 - v_coord.y );
		gl_FragColor = texture2D(u_color_texture, coord);
	}

\basicFx.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	uniform sampler2D u_color_texture;

	vec3 uncharted2Tonemap(const vec3 x) {
		const float A = 0.15;
		const float B = 0.50;
		const float C = 0.10;
		const float D = 0.20;
		const float E = 0.02;
		const float F = 0.30;
		return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
	}

	// http://filmicworlds.com/blog/filmic-tonemapping-operators/
	vec3 tonemapUncharted2(const vec3 color) {
		const float W = 11.2;
		const float exposureBias = 2.0;
		vec3 curr = uncharted2Tonemap(exposureBias * color);
		vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W));
		return curr * whiteScale;
	}


	void main() {

		vec2 uv = vec2(v_coord.x, 1.0 - v_coord.y);
		vec4 color = texture2D(u_color_texture, uv);

		color.rgb = tonemapUncharted2(color.rgb);
		color.rgb = pow(color.rgb, vec3(1./2.2));

		gl_FragColor = color;
	}

\screen_shader.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec2 a_coord;
	varying vec2 v_coord;

	void main() {
		v_coord = a_coord;
		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
	}

\workflow_wrap.fs

	precision highp float;
	varying vec2 v_coord;

	uniform sampler2D u_textureA;
	uniform sampler2D u_textureB;
	uniform sampler2D u_textureC;
	uniform sampler2D u_textureD;

	uniform vec4 u_channels;
	uniform vec4 u_fill;

	void main()
	{
		float R = u_fill.r;
		float G = u_fill.g;
		float B = u_fill.b;
		float A = u_fill.a;

		if(u_channels.r == 1.0)
			R = texture2D(u_textureA, v_coord).r;
		if(u_channels.g == 1.0)
			G = texture2D(u_textureB, v_coord).r;
		if(u_channels.b == 1.0)
			B = texture2D(u_textureC, v_coord).r;
		if(u_channels.a == 1.0)
			A = texture2D(u_textureD, v_coord).r;

		gl_FragColor = vec4(R, G, B, A);
	}

\combineHDR.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_viewport;

	uniform sampler2D u_hdr_texture;

	uniform vec3 u_hdr_avg;
	uniform vec3 u_tmp_avg;

	uniform vec3 u_hdr_min;
	uniform vec3 u_hdr_max;

	uniform vec3 u_max_lum_pixel;
	uniform float u_max_lum;

	uniform vec3 u_min_lum_pixel;
	uniform float u_min_lum;

	uniform float u_max_radiance;
	uniform float u_exp;

	void scale ( inout vec3 Xi ) {

		float A = 20.4730;
		float B = 44.9280;
		float C = 36.7912;
		float D = 13.5250;
		float E = 2.47270;
		float F = 0.14253;
		float G = 0.00032;

		Xi = A * pow(Xi,vec3(6.0))
		- B * pow(Xi,vec3(5.0))
		+ C * pow(Xi,vec3(4.0))
		- D * pow(Xi,vec3(3.0))
		+ E * pow(Xi,vec3(2.0))
		- F * Xi
		+ G;

		Xi *= u_max_radiance;
	}


	vec3 applyGamma ( vec3 Zi, float gamma ) {
	
		return pow(Zi, vec3(1.0/gamma));
	}

	void intensityAdjustment ( inout vec3 Zi, float BIAS ) {
	
		vec3 minLum = u_hdr_min;
		vec3 maxLum = u_hdr_max;
		
		vec3 pattern = u_tmp_avg; // pattern is already in range 0-1
		vec3 average = (1.0)/(maxLum-minLum)*(u_hdr_avg-minLum); // this average is not

		//scale(pattern);
		//scale(average);

		Zi *= (pattern / average) * BIAS;
	}

	void main() {

		vec3 Xi = texture2D(u_hdr_texture, v_coord).rgb;

		// linear normalizing to 0-1
		vec3 minLum = u_min_lum_pixel;
		vec3 maxLum = u_max_lum_pixel;
		vec3 Zi = (1.0)/(maxLum-minLum)*(Xi-minLum);

		// scale (not linear) to max intensity (100, 200, 300??)
		scale(Zi);

		// adjust with pattern intensities
		intensityAdjustment( Zi, 2.0 ); 

		// apply exposure and tonemapping
		Zi *= pow(2.0, u_exp);
		
		gl_FragColor = vec4(Zi,1.0);
	}

\assemblyViewer.fs

	precision highp float;
	varying vec2 v_coord;

	uniform sampler2D u_hdr_texture;

	void main() {

		// vec2 coords = vec2(v_coord.x, 1.0-v_coord.y);

		vec3 hdr = texture2D(u_hdr_texture, v_coord).rgb;
		float logAvgLum = exp( texture2D(u_hdr_texture, v_coord, 20.0).a );
		gl_FragColor = vec4(hdr, logAvgLum);
	}

\QUAD_VERTEX_SHADER.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec2 a_coord;
	varying vec2 v_coord;
	uniform vec2 u_position;
	uniform vec2 u_size;
	uniform vec2 u_viewport;
	uniform mat3 u_transform;
	void main() { 
		vec3 pos = vec3(u_position + vec2(a_coord.x,1.0 - a_coord.y)  * u_size, 1.0);
		v_coord = a_coord; 
		pos = u_transform * pos;
		pos.z = 0.0;
		//normalize
		pos.x = (2.0 * pos.x / u_viewport.x) - 1.0;
		pos.y = -((2.0 * pos.y / u_viewport.y) - 1.0);
		gl_Position = vec4(pos, 1.0); 
	}

\NoneHDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	uniform float u_hdr_scale;
	uniform vec4 u_WhiteBalance[16];
	uniform int u_numImages;
	varying vec2 v_coord;

	void main() {

		int refId = int(float(u_numImages) / 2.0);
		vec3 color = texture2D(u_texture, v_coord).rgb;
		color /= pow(vec3(2.0), vec3(u_hdr_scale));

		// white balance with best exposed one		
		/*if(refId == 0)
		color /= u_WhiteBalance[0];
		else if(refId == 1)
		color /= u_WhiteBalance[1];
		else if(refId == 2)
		color /= u_WhiteBalance[2];
		else if(refId == 3)
		color /= u_WhiteBalance[3];
		else if(refId == 4)
		color /= u_WhiteBalance[4];
		else
		color /= u_WhiteBalance[5];*/

		color = pow(color, vec3(1.0/2.2));

		gl_FragColor = vec4(color, 1.0);
	}

\TestHDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	uniform float u_hdr_scale;
	varying vec2 v_coord;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}
	
	void main() {

		vec3 color = texture2D(u_texture, v_coord).rgb;
		color /= pow(vec3(2.0), vec3(u_hdr_scale));

		float logAvgLum = texture2D(u_texture_mip, v_coord, 20.0).a;
		logAvgLum /= pow(2.0, u_hdr_scale);
		logAvgLum = exp( logAvgLum );

		vec3 n = vec3(0.95);
		color.rgb = ((pow(color.rgb, n)) / ( pow(color.rgb, n) + pow(vec3(logAvgLum), n)));

		color.rgb = pow(color.rgb, vec3(1.0/2.2));

		gl_FragColor = vec4(color, 1.0);
	}


\ExponentialHDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	uniform float u_hdr_scale;
	varying vec2 v_coord;

	uniform float u_Key;
	
	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}
	
	void main() {

		vec3 hdr = texture2D(u_texture, v_coord).rgb;
		hdr /= pow(vec3(2.0), vec3(u_hdr_scale));

		
		float logAvgLum = texture2D(u_texture_mip, v_coord, 20.0).a;
		logAvgLum /= pow(2.0, u_hdr_scale);
		logAvgLum = exp( logAvgLum );

		float B = u_Key;

		float lum = luminance(hdr);
		float lum_TM = 1.0 - exp( -B * lum/logAvgLum );

		hdr.rgb *= lum_TM/lum;

		hdr.rgb = pow(hdr.rgb, vec3(1.0/2.2));

		gl_FragColor = vec4(hdr, 1.);
	}

\PTR_HDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	uniform float u_hdr_scale;
	varying vec2 v_coord;

	uniform float u_Key;
	uniform float u_Ywhite;
	uniform float u_PreExposure;
	uniform float u_PostExposure;
	uniform float u_Saturation;

	const mat3 RGB_2_XYZ = (mat3(
		0.4124564, 0.3575761, 0.1804375,
		0.2126729, 0.7151522, 0.0721750,
		0.0193339, 0.1191920, 0.9503041
	));

	/*const mat3 XYZ_2_RGB = (mat3(
		 3.2404542,-1.5371385,-0.4985314,
		-0.9692660, 1.8760108, 0.0415560,
		 0.0556434,-0.2040259, 1.0572252
	));*/

	vec3 rgb_to_xyz(vec3 rgb) {
		return RGB_2_XYZ * rgb;
	}

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}

	vec3 global(vec3 RGB, float logAvgLum)
	{
		float Ywhite = u_Ywhite;
		float sat = clamp(u_Saturation, 0.001, 2.0);
		float key = clamp(u_Key, 0.001, 1.0);

		vec3 XYZ = rgb_to_xyz( RGB );

		float Yw = XYZ.y;
		float Y = (key / logAvgLum) * Yw;
		float Yd = (Y * (1.0 + (Y/(Ywhite * Ywhite)))) / (1.0 + Y);

		return pow( RGB / Yw, vec3(sat)) * Yd;
	}
	
	void main() {

		vec3 hdr = texture2D(u_texture, v_coord).rgb * u_PreExposure;
		hdr /= pow(vec3(2.0), vec3(u_hdr_scale));
		
		
		float logAvgLum = texture2D(u_texture_mip, v_coord, 20.0).a;
		logAvgLum /= pow(2.0, u_hdr_scale);
		logAvgLum = exp( logAvgLum );

		vec4 color = vec4(global( hdr.rgb, logAvgLum ), 1.0);
		color.rgb = pow(color.rgb, vec3(1.0/2.2));

		gl_FragColor = vec4(vec3(color), 1.0);
	}

//
// Luminance shader
//

\maxLum.fs

	precision highp float;
	
	uniform sampler2D u_texture;
	varying vec2 v_coord;
	
	#ifdef INPUT_TEX_WIDTH
		const float width = float(INPUT_TEX_WIDTH);
	#endif
	#ifdef INPUT_TEX_HEIGHT
		const float height = float(INPUT_TEX_HEIGHT);
	#endif

	void main() {
		
		float max = -1.0;
		
		for(float i = 0.5; i < width; i+=15.0)
		for(float j = 0.5; j < height; j+=15.0)
		{
			vec2 coord = vec2(i, j) / vec2(width, height);
			vec4 pixelColor = texture2D(u_texture, coord );
			
			float lum = 0.2126 * pixelColor.r + 0.7152 * pixelColor.g + 0.0722 * pixelColor.b;
			
			if(lum > max)
				max = lum;
		}

		vec4 color = vec4(max,0.0, 0.0, 0.0);
		gl_FragColor = color;
	}

\luminance.fs

	precision highp float;
	
	uniform sampler2D u_texture;
	
	const float size = 32.0;

	void main() {
		
		int k = 0;
		const float delta = 1e-4;
		float sumLog = 0.0;
		float sum = 0.0;
		
		for(float i = 0.5; i < size; i++)
		for(float j = 0.5; j < size; j++)
		{
			vec2 coord = vec2(i, j) / vec2(size, size);
			vec4 pixelColor = texture2D(u_texture, coord);

			float lum = max( 0.2126 * pixelColor.r + 0.7152 * pixelColor.g + 0.0722 * pixelColor.b, 0.0);
			float logLum = log( lum + delta );
			
			sum += lum;
			sumLog += logLum;
			k++;
		}

		float averageLum = sum / float(k);
		float averageLogLum = sumLog / float(k);
		gl_FragColor = vec4(averageLum, averageLogLum, 0.0, 1.0);
	}

//
// Reflect environment to an sphere (+ Exposure)
//

\mirroredSphere.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_EXT_draw_buffers : require

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	uniform vec4 u_color;
	uniform vec3 u_camera_position;
	
	uniform samplerCube u_SpecularEnvSampler_texture;

	void main() {

		vec3 V = normalize(u_camera_position - v_wPosition);
		vec3 N = normalize(v_wNormal);
		vec3 R = reflect(-V, N);
		gl_FragData[0] = pow(textureCubeLodEXT(u_SpecularEnvSampler_texture, R, 0.0), vec4(1.0/2.2));
	}

\diffCubemap.fs

	precision highp float;
	varying vec2 v_coord;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture0;
	uniform samplerCube u_color_texture1;
	uniform mat3 u_rotation;
	uniform float u_scale;

	void main() {

		vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
		vec3 dir = vec3( uv - vec2(0.5), 0.5 );
		dir = u_rotation * dir;

		vec4 a = textureCube(u_color_texture0, dir);
		vec4 b = textureCube(u_color_texture1, dir);	

		vec4 diff = abs(a - b);// * u_scale;
		diff = normalize(diff);

		gl_FragColor = diff;
	}
//
// Shader used to show skybox 
//

\skybox.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_EXT_draw_buffers : require

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_rotation;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform bool u_blur;

	uniform samplerCube u_color_texture;
	uniform bool u_flipX;
	uniform bool u_is_rgbe;
	uniform float u_render_mode;

	mat4 rotationMatrix(vec3 a, float angle) {

		vec3 axis = normalize(a);
		float s = sin(angle);
		float c = cos(angle);
		float oc = 1.0 - c;
		
		return mat4(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,0.0,
			oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,0.0,
			oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c,0.0,
			0.0,0.0,0.0,1.0);
	}

	void main() {

		vec3 E = normalize(v_wPosition - u_camera_position );

		if(u_flipX)
			E.x = -E.x;
		
		E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

		vec4 color = textureCubeLodEXT(u_color_texture, E, u_blur ? 1.0 : 0.0);

		// color = pow(color, vec4(2.2));

		if(u_is_rgbe)
			color = vec4(color.rgb * pow(2.0, color.a * 255.0 - 128.0), 1.0);
		
		if(u_render_mode > 1.0)
		{
			color = pow(color, vec4(1.0/2.2));
		}

		gl_FragData[0] = color;
	}

//
// Shader used to show skybox from sphere map (+ Exposure)
//

\sphereMap.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform sampler2D u_color_texture;
	uniform float u_fov;

	//u_fov = arctan(r/d);

	void main() {
	    vec3 E = normalize(v_wPosition - u_camera_position);

	    float d = sqrt(E.x * E.x + E.y * E.y);
		float r = 0.0;

		if(d > 0.0)
			r = 0.159154943 * acos(E.z) / d;

	    float u = 0.5 + E.x * r;
		float v = 0.5 + E.y * r;

	    vec2 spherical_uv = vec2(u, v);
	    vec4 color = texture2D(u_color_texture, spherical_uv);

	    gl_FragColor = color;
	}

//
// Blur cubemap depending on the roughness
//

\blur.vs

	precision highp float;
	attribute vec2 a_coord;
	uniform float u_ioffset;
	varying vec3 v_dir;
	varying vec2 v_coord;

	void main() {
		v_coord = a_coord;
		
		v_dir = vec3( v_coord - vec2(0.5), 0.5 );
		v_dir.y = -v_dir.y;

		gl_Position = vec4(vec3(a_coord * 2.0 - 1.0, 0.5), 1.0);
	}

\blur.fs

	precision highp float;

	varying vec3 v_dir;

	uniform samplerCube u_color_texture;
	uniform mat3 u_rotation;
	uniform float u_roughness;

	#import "brdf.inc"
	#define PI 3.1415926535897932384626433832795

	void main() {

		vec3 dir = v_dir;
		vec3 vView = normalize(u_rotation * dir);
		vec3 vNormal = vView;

		#ifdef N_SAMPLES
			const int SAMPLES = N_SAMPLES;
		#endif


		float fTotalWeight = 0.0;
		vec3 vPrefilteredColor = vec3(0.0);

		float size = max(256.0 / pow(2.0, u_roughness * 4.0), 8.0);

		for (int i = 0; i < N_SAMPLES; i++)
		{
		    vec2 polar_i = Fib( i, N_SAMPLES );
		    vec2 vXi = vec2(polar_i.y / (2.0 * PI), cos(polar_i.x));

		    vec3 vHalf = importanceSampleGGX(vXi, u_roughness, vNormal);
		    vec3 vLight = 2.0 * dot(vView, vHalf) * vHalf - vView;

		    float NdotL = dot(vNormal, vLight);

		    if (NdotL > 0.0)
		    {
			 // Vectors to evaluate pdf
			float NdotH = clamp(dot(vNormal, vHalf), 0.0, 1.0);
			float VdotH = NdotH;

			// Probability Distribution Function
			float fPdf = G_Smith(u_roughness, NdotH, NdotL) * NdotH / (4.0 * VdotH);
			// Solid angle represented by this sample
		        float fOmegaS = 1.0 / (float(N_SAMPLES) * fPdf);
			// Solid angle covered by 1 pixel with 6 faces that are EnvMapSize X EnvMapSize
			float fOmegaP = 4.0 * PI / (6.0 * size * size);
			// Original paper suggest biasing the mip to improve the results
			float fMipBias = 5.0;
			float fMipLevel = max(0.5 * log2(fOmegaS / fOmegaP) + fMipBias, 0.0);

			vPrefilteredColor += textureCube(u_color_texture, vHalf, fMipLevel).rgb * NdotL;
			fTotalWeight += NdotL;
		    }
		}
		
		gl_FragColor = vec4(vPrefilteredColor / fTotalWeight, 1.0);
	}

\defblur.vs

	precision highp float;
	attribute vec2 a_coord;
	uniform float u_ioffset;
	uniform float u_blocks;
	varying vec3 v_dir;
	varying vec2 v_coord;

	void main() {

		vec2 uv = a_coord;
		uv.x /= u_blocks;
		uv.x += u_ioffset;
	
		v_coord = uv;
		v_dir = vec3( uv - vec2(0.5), 0.5 );
		v_dir.y = -v_dir.y;

		gl_Position = vec4(vec3(a_coord * 2.0 - 1.0, 0.5), 1.0);
	}

\defblur.fs

	#extension GL_EXT_shader_texture_lod : enable
	precision highp float;

	uniform samplerCube u_color_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 

	uniform float u_mipCount;

	varying vec3 v_dir;
	varying vec2 v_coord;

	const float PI = 3.1415926535897932384626433832795;
	const int iNumSamples = 1024;

	#ifdef EM_SIZE
		const float size = float(EM_SIZE);
	#endif

	void main() {

		vec3 N = normalize( u_rotation * v_dir );

		vec4 color = vec4(0.0);
		float roughness = clamp(u_roughness, 0.0045, 0.98);
		float alphaRoughness = roughness * roughness;

		float lod = clamp(roughness * u_mipCount, 0.0, u_mipCount);

		// (gl_FragCoord.xy) / vec2(size, size) = v_coord
		const float step = 2.0;
		float cfs = size / pow(2.0, lod);
	
		for(float i = 0.5; i < size; i+=step)
		for(float j = 0.5; j < size; j+=step) {

			// Get pixel
			vec2 r_coord = vec2(i, j) / vec2(size, size);

			// Get 3d vector
			vec3 dir = vec3( r_coord - vec2(0.5), 0.5 );
			dir.y *= -1.0;

			// Use all faces
			for(int iface = 0; iface < 6; iface++) {

				mat3 _camera_rotation = u_cameras[iface];
				vec3 pixel_normal = normalize( _camera_rotation * dir );

				float dotProduct = max(0.0, dot(N, pixel_normal));
				float glossScale = 8.0;
				float glossFactor = (1.0 - roughness );
				float cmfs = size/pow(2.0, lod);
				float weight = pow(dotProduct, cmfs * glossFactor * glossScale );

				if(weight > 0.0 ) {
					color.rgb += textureCube(u_color_texture, pixel_normal).rgb * weight;
					color.a += weight;
				}
			}


		}

		float invWeight = 1.0/color.a;
		gl_FragColor = vec4(color.rgb * invWeight, 1.0);
	}

\CMFT.fs

	#extension GL_EXT_shader_texture_lod : enable
	precision highp float;

	uniform samplerCube u_color_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 

	uniform float u_mipCount;

	varying vec3 v_dir;
	varying vec2 v_coord;

	const float PI = 3.14159265359;
	const int iNumSamples = 1024;

	#ifdef EM_SIZE
		const float size = float(EM_SIZE);
	#endif

	#import "brdf.inc"

	float warpFixupFactor(float _faceSize)
    {
        // Edge fixup.
        // Based on Nvtt : http://code.google.com/p/nvidia-texture-tools/source/browse/trunk/src/nvtt/CubeSurface.cpp
        if (_faceSize == 1.0)
            return 1.0;

        float fs = _faceSize;
        float fsmo = fs - 1.0;
        return (fs*fs) / (fsmo*fsmo*fsmo);
    }

	float specularPowerFor(float roughness, float _glossScale, float _glossBias)
    {
        float glossiness = max(0.0, 1.0 - roughness);
        float specularPower = pow(2.0, _glossScale * glossiness + _glossBias);
        return specularPower;
    }
	
	/// Returns the angle of cosine power function where the results are above a small empirical treshold.
    float cosinePowerFilterAngle(float _cosinePower)
    {
        // Bigger value leads to performance improvement but might hurt the results.
        // 0.00001f was tested empirically and it gives almost the same values as reference.
        const float treshold = 0.00001;

        // Cosine power filter is: pow(cos(angle), power).
        // We want the value of the angle above each result is <= treshold.
        // So: angle = acos(pow(treshold, 1.0 / power))
        return acos(pow(treshold, 1.0 / _cosinePower));
    }

	/// http://www.mpia-hd.mpg.de/~mathar/public/mathar20051002.pdf
    /// http://www.rorydriscoll.com/2012/01/15/cubemap-texel-solid-angle/
	float areaElement(float _x, float _y)
    {
        return atan(_x*_y, sqrt(_x*_x + _y*_y + 1.0));
    }

    /// _u and _v should be center adressing and in [-1.0+invSize..1.0-invSize] range.
    float texelSolidAngle(float _u, float _v, float _invFaceSize)
    {
        // Specify texel area.
        float x0 = _u - _invFaceSize;
        float x1 = _u + _invFaceSize;
        float y0 = _v - _invFaceSize;
        float y1 = _v + _invFaceSize;

        // Compute solid angle of texel area.
        float solidAngle = areaElement(x1, y1)
                               - areaElement(x0, y1)
                               - areaElement(x1, y0)
                               + areaElement(x0, y0)
                               ;

        return solidAngle;
    }

	void main() {

		vec3 normal = normalize( u_rotation * v_dir );

		vec4 color = vec4(0.0);
		float TotalWeight = 0.0;
		float roughness = clamp(u_roughness, 0.0045, 0.98);
		float alphaRoughness = roughness * roughness;

		float lod = clamp(roughness * u_mipCount, 0.0, u_mipCount);

		const float step = 4.0;
		float cfs = size / pow(2.0, lod);
        float invCfs = 1.0 / cfs;

		// Edge fixup
		float warpFactor = warpFixupFactor(cfs);
	
		for(float i = 0.5; i < size; i+=step)
		for(float j = 0.5; j < size; j+=step) {

			// Get pixel
			vec2 r_coord = vec2(i, j) / vec2(size, size);
			// Get 3d vector
			vec3 dir = vec3( r_coord - vec2(0.5), 0.5 );
			dir.y *= -1.0;

			// Use all faces
			for(int iface = 0; iface < 6; iface++) {

				mat3 _camera_rotation = u_cameras[iface];
				vec3 _tapVec = normalize( _camera_rotation * dir );

				float uu = r_coord.x;
				float vv = r_coord.y;

				// edge fixup
				if(false)
				{
					uu = (warpFactor * uu*uu*uu) + uu;
       				vv = (warpFactor * vv*vv*vv) + vv;
				}

				float dotProduct = dot(normal, _tapVec);
				float specularPower = specularPowerFor(roughness, 1.0, 0.0001);
				float angle = cosinePowerFilterAngle(specularPower);

				if (dotProduct >= angle) // >= _specularAngle ???
				{
					float solidAngle = texelSolidAngle(uu, vv, invCfs);
					float weight = solidAngle * pow(dotProduct, specularPower);

					color.rgb  	+= textureCube(u_color_texture, _tapVec).rgb * weight;
					color.a 	+= weight;
				}

				if(color.a != 0.0 ) {
					float invWeight = (1.0)/color.a;
					color.rgb *= invWeight;
				}
				// result of convolution is 0 -> take direct sample
				else
				{
					color.rgb = textureCube(u_color_texture, normal).rgb;
				}
				
			}
		}

		gl_FragColor = vec4(color.rgb, 1.0);
	}

//
// Deferred shading
//

\ssao.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
	uniform vec4 u_viewport;
	uniform vec2 u_resolution;

	uniform mat4 u_invp;
	uniform mat4 u_invv;
	uniform mat4 u_invvp;
	uniform mat4 u_projection;
	uniform mat4 u_view;

	uniform float u_near;
	uniform float u_far;

	uniform sampler2D u_color_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_depth_texture;
	uniform sampler2D u_noise_texture;

	uniform bool u_downsampled;
	uniform vec3 u_samples[64];
	uniform float u_radius;
	uniform float u_bias;

	uniform float u_max_dist;
	uniform float u_min_dist;
	uniform float u_ao_power;

	varying vec2 v_coord;

	#import "matrixOp.inc"

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

	vec3 getPositionFromDepth(float depth, vec2 uvs) {
       
        depth = depth * 2.0 - 1.0;
        vec2 pos2D = uvs * 2.0 - vec2(1.0);
        vec4 pos = vec4( pos2D, depth, 1.0 );
        pos = u_invvp * pos;
        pos.xyz = pos.xyz / pos.w;

        return pos.xyz;
    }

	void main() {
		
		/*
		*	GET INFO
		*/
		
		vec2 coord = gl_FragCoord.xy / u_resolution;

		// Texture Maps
		vec4 colorMap = texture2D( u_color_texture, coord );
		vec4 depthMap = texture2D( u_depth_texture, coord);
		vec4 normalMap = texture2D( u_normal_texture, coord);
		vec3 normal    = normalize(normalMap.xyz * 2. - 1.);
		
		// Sample depth
		float depth = texture2D( u_depth_texture, coord ).x;

		// Vectors
		normal = (u_view * vec4(normal, 0.0) ).xyz;
		vec3 position = getPositionFromDepth(depth, coord);
		position =  (u_view * vec4(position, 1.0) ).xyz;
		
		/*
		*	SSAO
		*/

		float width = u_resolution.x;
		float height = u_resolution.y;

		// Random vector per fragment
		if(u_downsampled)
		{
			width /= 4.0;
			height /= 4.0;
		}

		vec2 noiseScale = vec2(width/4.0, height/4.0); 
		vec3 randomVec = texture2D(u_noise_texture, coord * noiseScale).xyz * 2.0 - vec3(1.0);
		vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
		vec3 bitangent = cross(normal, tangent);
		mat3 TBN       = mat3(tangent, bitangent, normal);  

		float radius = u_radius;
		float bias = u_bias;
		float occlusion = 0.0;

		if(depth == 1.0) 
		{
			occlusion = 1.0;
		}
		else
		{
			for(int i = 0; i < 64; ++i)
			{
				// get sample position
				vec3 sample = TBN * u_samples[i]; // From tangent to view-space
				sample = position + sample * radius + bias;
				
				// transform to screen space 
				vec2 offset = viewSpaceToScreenSpaceTexCoord(sample);
				float sampleDepth = readDepth(u_depth_texture, offset);

				if( abs( (-sample.z) - sampleDepth ) > u_max_dist )
				continue;

				if( abs( (-sample.z) - sampleDepth ) < u_min_dist )
				continue;

				float rangeCheck =  smoothstep(0.0, 1.0, radius / abs((-sample.z) - sampleDepth));
				occlusion += (sampleDepth <= -sample.z ? 1.0 : 0.0) * rangeCheck;
			} 

			occlusion *= u_ao_power;
			occlusion = 1.0 - (occlusion / 64.0);
		}

		gl_FragColor = vec4(vec3(occlusion), 1.0);
	}

\ssr.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
	uniform vec4 u_viewport;

	uniform vec3 u_camera_position;
	uniform mat4 u_invp;
	uniform mat4 u_invv;
	uniform mat4 u_invvp;
	uniform mat4 u_projection;
	uniform mat4 u_view;
	uniform float u_near;
	uniform float u_far;

	uniform sampler2D u_color_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_depth_texture;

	varying vec2 v_coord;

	#import "matrixOp.inc"

	vec3 getPositionFromDepth(float depth) {
       
        depth = depth * 2.0 - 1.0;
        vec2 pos2D = v_coord * 2.0 - vec2(1.0);
        vec4 pos = vec4( pos2D, depth, 1.0 );
        pos = u_invvp * pos;
        pos.xyz = pos.xyz / pos.w;

        return pos.xyz;
    }

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
		
		// Texture Maps
		vec4 colorMap = texture2D( u_color_texture, v_coord );
		vec4 depthMap = texture2D( u_depth_texture, v_coord);
		vec4 normalMap = texture2D( u_normal_texture, v_coord);

		if(depthMap.x == 1.0)
		discard;

		// Vectors
		vec3 position = getPositionFromDepth(depthMap.x);
		vec3 normal    = normalize(normalMap.xyz * 2. - 1.);

		// To view space
		normal = (u_view * vec4(normal, 0.0) ).xyz;
		position =  (u_view * vec4(position, 1.0) ).xyz;
		
		/*
		*	SSR
		*/
		vec3 basePos = position;
		vec3 pos = basePos;

		vec3 I = normalize(pos);
		vec3 R = normalize(reflect(I, normal));

		float iterStep = 0.01;
		vec2 coord;

		pos += (R * 0.05);

		const int max_steps = 64;

		
		for(int i = 0; i < max_steps; ++i)
		{
			pos += (R * iterStep);
			coord = viewSpaceToScreenSpaceTexCoord(pos);
			float pixelDepth = readDepth(u_depth_texture, coord);

			float diff = (-pos.z) - pixelDepth;

			if (diff > 0. && diff < 0.1)
			{
				pos -= R * iterStep;
				iterStep *= 0.5;
			}
		}

		float visible = 0.;

		coord = viewSpaceToScreenSpaceTexCoord(pos);
		float pixelDepth = readDepth(u_depth_texture, coord);
		vec3 pixelNormal = normalize( texture2D( u_normal_texture, coord).xyz * 2.0 - 1.0);
		float diff = (-pos.z) - pixelDepth;
		
		float RdotPN = dot(R, pixelNormal);
		float ndotr = dot(R, normal);

		vec3 cam = world2view( u_camera_position );
		vec3 E = normalize(cam - pos);
		float EdotN = dot(E, normal);

		// collision rays
		if(abs(diff) < 0.12)
		 	visible = 1.;

		// backface collision
		if(RdotPN >= 0.0)
			visible = 0.;
		
		vec4 reflectionColor = texture2D(u_color_texture, coord)  * visible;
		reflectionColor *= 	smoothstep(1.,0.,ndotr);

		float dist = distance(pos, basePos);
		float fresnel = pow(1. - EdotN, 1.);

		reflectionColor *= fresnel;

		gl_FragColor = vec4(reflectionColor.rgb, 1.0);
	}

\multiplyPass.fs

	precision highp float;
	uniform sampler2D u_color_texture;
	uniform sampler2D u_output_texture;
	varying vec2 v_coord;

	uniform int u_output_buffer;

	void main() {
		
		vec4 color = texture2D( u_color_texture, v_coord );
		vec4 pass_output = texture2D( u_output_texture, v_coord );
		
		if(u_output_buffer == 0) // DEFAULT
			color *= pass_output;
		else if(u_output_buffer == 1)	 // SSAO
			color = pass_output;

		// else its BEAUTY 

		gl_FragColor = color;
	}

\linearDepth.fs

	precision highp float;
	uniform float u_near;
	uniform float u_far;
	uniform sampler2D u_fbo_depth_texture;
	varying vec2 v_coord;

	float getLinearDepth( float z, float n, float f) {
		
		float EZ  = (2.0 * n * f) / (f + n - z * (f - n));
		float LZ  = (EZ - n) / (f - n);

		return LZ;
	}

	void main() {
		
		float depth = texture2D(u_fbo_depth_texture, v_coord).r;
		float realDepth = getLinearDepth(depth, u_near, u_far );

		gl_FragColor = vec4(vec3(realDepth), 1.0);
	}


\glow.fs
	precision highp float;
	varying vec2 v_coord;
	uniform sampler2D u_texture;
	uniform sampler2D u_glow_texture;
	uniform vec2 u_texel_size;
	uniform float u_delta;
	uniform float u_intensity;
	uniform float u_dirt_factor;
	
	vec4 sampleBox(vec2 uv) {
		vec4 o = u_texel_size.xyxy * vec2(-u_delta, u_delta).xxyy;
		vec4 s = texture2D( u_glow_texture, uv + o.xy ) + texture2D( u_glow_texture, uv + o.zy) + texture2D( u_glow_texture, uv + o.xw) + texture2D( u_glow_texture, uv + o.zw);
		return s * 0.25;
	}

	void main() {
		vec4 glow = sampleBox( v_coord );
		gl_FragColor = texture2D( u_texture, v_coord ) + u_intensity * glow;
	}

/*
*	INC
*/

\tonemap.inc

	vec3 atmosTonemap( vec3 color ) {

		return 1.0 - exp(-1.0 * color);
	}

	vec3 uncharted2Tonemap(const vec3 x) {
		const float A = 0.15;
		const float B = 0.50;
		const float C = 0.10;
		const float D = 0.20;
		const float E = 0.02;
		const float F = 0.30;
		return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
	}

	// http://filmicworlds.com/blog/filmic-tonemapping-operators/
	vec3 tonemapUncharted2(const vec3 color) {
		const float W = 11.2;
		const float exposureBias = 2.0;
		vec3 curr = uncharted2Tonemap(exposureBias * color);
		vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W));
		return curr * whiteScale;
	}

	// Based on Filmic Tonemapping Operators http://filmicgames.com/archives/75
	// https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ToneMapping.hlsl
	vec3 tonemapFilmic(const vec3 color) {
		vec3 x = max(vec3(0.0), color - 0.004);
		return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
	}

	// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
	vec3 acesFilm(const vec3 x) {
		const float a = 2.51;
		const float b = 0.03;
		const float c = 2.43;
		const float d = 0.59;
		const float e = 0.14;
		return clamp((x * (a * x + b)) / (x * (c * x + d ) + e), 0.0, 1.0);
	}

	vec3 exponential(const vec3 color, const float logMean) {
		float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
		float lum_TMO = 1.0 - exp( -0.35 * lum/logMean );
		vec3 color_TMO = color * (lum_TMO/lum);
		return mix(color, color_TMO, 1.0); 
	}

	float log10( float x ) {

		const float invLog10 = 0.43429448190325176;
		return (invLog10) * log(x);
	}

	vec3 logTM(const vec3 color, const float maxLum) {

		float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
		float lum_TM = log10(1.0+lum)/log10(1.0+maxLum);

		return color.rgb * lum_TM/lum;
	}

	vec3 tonemapReinhard(const vec3 color) {
		return color / (color + vec3(1.0));
	}

\brdf.inc

	// Geometry Term : Geometry masking / shadowing due to microfacets
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float roughness, float NdotV, float NdotL){
		float k = (roughness )*(roughness ) / 2.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}

	// Given an index and Nº of samples
	// output: vec2 containing spherical coordinates of the sample
	vec2 Fib( const in int index, const in int numSamples ) {

		float PI = 3.1415926535897932384626433832795;

		float d_phiAux = PI * (3.0 - sqrt(5.0));
		float phiAux = 0.0;
		float d_zAux = 1.0 / float(numSamples);
		float zAux = 1.0 - (d_zAux / 2.0);
		float thetaDir;
		float phiDir;

		zAux -= d_zAux * float(index);
		phiAux += d_phiAux * float(index);

		thetaDir = acos(zAux);
		phiDir = mod(phiAux, (2.0 * PI));

		return vec2(thetaDir, phiDir);
	}

	// Given a sample in [0, 1] coordinates
	// output: vec3 containing 3d direction of the sample (??)
	// https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch20.html
	vec3 importanceSampleGGX( vec2 Xi, float Roughness, vec3 N ) {

		const float PI = 3.1415926535897932384626433832795;
	    float a = Roughness * Roughness;

	    float Phi = 2.0 * PI * Xi.x;

	    float CosTheta = sqrt( (1.0 - Xi.y) / ( 1.0 + (a * a - 1.0) * Xi.y ) );
	    float SinTheta = sqrt( 1.0 - CosTheta * CosTheta );

	    vec3 H;
	    H.x = SinTheta * cos( Phi );
	    H.y = SinTheta * sin( Phi );
	    H.z = CosTheta;

	    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0,0.0,1.0) : vec3(0.0,1.0,0.0);
	    vec3 TangentX = normalize( cross( UpVector, N ) );
	    vec3 TangentY = normalize( cross( TangentX, N ) );

	    // Tangent space to world space
	    return TangentX * H.x + TangentY * H.y + N * H.z;
	}

\pbr.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;
	attribute vec4 a_bone_indices;
	attribute vec4 a_weights;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;
	uniform mat4 u_bones[64];
	uniform bool u_Skinning;

	uniform float u_bumpScale;
	uniform sampler2D u_height_texture;
	uniform mat4 u_mvp;
	uniform mat4 u_viewprojection;
	uniform mat4 u_model;
	uniform mat4 u_invv;
	uniform mat4 u_view;

	void computeSkinning(inout vec3 vertex, inout vec3 normal)
	{
		vec4 v = vec4(vertex,1.0);
		vertex = (u_bones[int(a_bone_indices.x)] * a_weights.x * v + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * v + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * v + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * v).xyz;
		vec4 N = vec4(normal,0.0);
		normal =	(u_bones[int(a_bone_indices.x)] * a_weights.x * N + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * N + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * N + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * N).xyz;
		normal = normalize(normal);
	}

	void main() {

		vec3 vertex = a_vertex;
		vec3 normal = a_normal;

		if(u_Skinning)
			computeSkinning(vertex,normal);

		v_wPosition = (u_model * vec4(vertex, 1.0)).xyz;
		v_wNormal = (u_model * vec4(normal, 0.0)).xyz;
		v_coord = a_coord;

		vec3 position = vertex;
		mat4 transform_matrix = u_viewprojection;

		// has_bump
		if(u_properties_array1.w == 1.) {
		    vec4 bumpData = texture2D( u_height_texture, v_coord );
		    float vAmount = bumpData.r;
		    position += (normalize(v_wNormal) * vAmount * u_bumpScale);
		    v_wPosition = (u_model * vec4(position, 1.0)).xyz;
		}

		gl_Position = transform_matrix * vec4(v_wPosition, 1.0);
	}

\pbr.fs

	#extension GL_OES_standard_derivatives : enable
	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_EXT_draw_buffers : require
	precision highp float;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform mat4 u_invp;
	uniform mat4 u_invv;
	uniform mat4 u_invvp;
	uniform mat4 u_projection;
	uniform mat4 u_view;

	uniform float u_mipCount;
	uniform float u_rotation;
	uniform float u_light_intensity;
	uniform vec3 u_light_color;
	uniform vec3 u_light_position;
	uniform vec3 u_light_direction;
	uniform vec2 u_light_angle;
	uniform vec3 u_camera_position;
	uniform vec3 u_background_color;
	uniform vec4 u_viewport;
	uniform float u_ibl_scale;
	uniform int u_render_mode;

	// Mat properties
	uniform vec3 u_albedo;
	uniform float u_roughness;
	uniform float u_metalness;
	uniform float u_alpha;
	uniform float u_alpha_cutoff;
	uniform vec3 u_tintColor;
	uniform float u_emissiveScale;
	uniform float u_normalFactor;
	uniform bool u_metallicRough;
	uniform float u_reflectance;
	uniform float u_SpecScale;

	uniform float u_clearCoat;
	uniform float u_clearCoatRoughness;
	
	uniform bool u_isAnisotropic;
	uniform float u_anisotropy;
	uniform vec3 u_anisotropy_direction;

	uniform sampler2D u_brdf_texture;

	// Mat textures
	uniform sampler2D u_albedo_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_roughness_texture;
	uniform sampler2D u_metalness_texture;
	uniform sampler2D u_opacity_texture;
	uniform sampler2D u_height_texture;
	uniform sampler2D u_emissive_texture;
	uniform sampler2D u_ao_texture;
	

	// Environment textures
	uniform samplerCube u_SpecularEnvSampler_texture;
	uniform vec3 u_sh_coeffs[9];

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;

	// GUI
	uniform bool u_flipX;
	uniform bool u_renderDiffuse;
	uniform bool u_renderSpecular;
	uniform bool u_useDiffuseSH;
	uniform bool u_enable_ao;
	uniform bool u_gamma_albedo;
	
	#import "sh.inc"
	#import "bump.inc"
	#import "pbr_brdf.inc"
	#import "matrixOp.inc"

	SH9Color coeffs;

	vec3 getReflectedVector(PBRMat material) {
		
		float anisotropy = material.anisotropy;
		vec3 tangent = material.anisotropicT;
		vec3 bitangent = material.anisotropicB;

		vec3 anisotropicDirection = anisotropy >= 0.0 ? bitangent : tangent;
		vec3 anisotropicTangent = cross(anisotropicDirection, material.V);//vec3(1.0, 0.0, 0.0));
		vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
		vec3 bentNormal = normalize(mix(material.N, anisotropicNormal, anisotropy));
		return reflect(material.V, bentNormal);
	}

	void updateVectors (inout PBRMat material) {

		vec3 v = normalize(u_camera_position - v_wPosition);
		vec3 n = normalize( v_wNormal );

		if(u_properties_array0.w != 0.){
			vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
			vec3 n2 = perturbNormal( n, -v, v_coord, normal_map );
			n = normalize(mix(n, n2, u_normalFactor));
		}

		material.reflection = normalize(reflect(-v, n));

		material.N = n;
		material.V = v;
		
		// anisotropy
	 	mat3 tangentToWorld;
		vec3 up = vec3(0.0, 1.0, 0.0);
		tangentToWorld[0] = normalize(cross(up, n));
		tangentToWorld[1] = cross(n, tangentToWorld[0]);
		tangentToWorld[2] = n;
		material.tangentToWorld = tangentToWorld;

		vec3 anisotropicT = normalize(tangentToWorld * vec3(u_anisotropy_direction));
		vec3 anisotropicB = normalize(cross(n, anisotropicT));

		material.anisotropicT = anisotropicT;
		material.anisotropicB = anisotropicB;

		// if material has anisotropy
		// or either has isotropy (more common)
		if(u_isAnisotropic)
			material.reflection = getReflectedVector(material);

		if(u_flipX)
			material.reflection.x = -material.reflection.x;

		material.NoV = clamp(dot(n, v), 0.0, 0.99) + 1e-6;
	}

	void createMaterial (inout PBRMat material) {
		
		float metallic = max(0.004, u_metalness);
		
		if(u_properties_array0.z != 0.)
			metallic *= texture2D(u_metalness_texture, v_coord).r;

		vec3 baseColor = u_albedo;
		if(u_properties_array0.x != 0.){
			vec3 albedo_tex = texture2D(u_albedo_texture, v_coord).rgb;
			albedo_tex = pow(albedo_tex, vec3(GAMMA));
			baseColor *= albedo_tex;
		}

		vec3 reflectance = vec3(u_reflectance);

		// GET ROUGHNESS PARAMS
		float roughness = u_roughness;
		if(u_properties_array0.y != 0.){
				
			vec3 sampler_info = texture2D(u_roughness_texture, v_coord).rgb;

			if(u_metallicRough) {
				roughness *= sampler_info.g; // roughness stored in g
				metallic = max(0.01, u_metalness) * sampler_info.b; // recompute metallness using metallic-rough texture
			}
			else
				roughness *= sampler_info.r;
		}

		roughness = clamp(roughness, MIN_ROUGHNESS, 1.0);	

		vec3 diffuseColor = computeDiffuseColor(baseColor, metallic);
		vec3 f0 = computeF0(baseColor, metallic, reflectance);

		// GET COAT PARAMS
		float clearCoat = u_clearCoat; // clear coat strengh
		float clearCoatRoughness = u_clearCoatRoughness;

		clearCoatRoughness = mix(MIN_PERCEPTUAL_ROUGHNESS, MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS, clearCoatRoughness);
		float clearCoatLinearRoughness = sq(clearCoatRoughness);

		// recompute f0 by computing its IOR
		f0 = mix(f0, f0ClearCoatToSurface(f0, 1.5), clearCoat);

		float linearRoughness = roughness * roughness;

		// remap roughness: the base layer must be at least as rough as the clear coat layer
		roughness = clearCoat > 0.0 ? max(roughness, clearCoatRoughness) : roughness;

		material.roughness = roughness;
		material.linearRoughness = linearRoughness;
		material.clearCoat = clearCoat;
		material.clearCoatRoughness = clearCoatRoughness;
		material.clearCoatLinearRoughness = clearCoatLinearRoughness;
		material.metallic = metallic;
		material.f0 = f0;
		material.diffuseColor = diffuseColor;
		material.baseColor = baseColor;
		material.reflectance = reflectance;
		material.anisotropy = u_anisotropy;
		
		updateVectors( material );
	}

	vec3 rotateVector(vec3 v, float angle)
	{
		vec3 axis = vec3(0.0,1.0,0.0);
		float s = sin(angle);                                                                                                                          
		float c = cos(angle);
		float oc = 1.0 - c;

		mat4 mat =  mat4(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,0.0,
		oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,0.0,
		oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c,0.0,
		0.0,0.0,0.0,1.0);

		return (mat * vec4(v,1.0)).xyz;
	}

	vec3 prem(vec3 R, float roughness, float rotation) {
		float 	f = roughness * u_mipCount;
		vec3 	r = rotateVector(R, rotation);
		return textureCubeLodEXT(u_SpecularEnvSampler_texture, r, f).rgb;
	}

	vec3 FresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
	{
		return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
	}

	void getIBLContribution (PBRMat material, inout vec3 Fd, inout vec3 Fr)
	{
		float NdotV = material.NoV;

		vec2 brdfSamplePoint = vec2(NdotV, clamp(material.roughness, 0.01, 0.99));
		vec2 brdf = texture2D(u_brdf_texture, brdfSamplePoint).rg;

		vec3 normal = material.N;
		if(u_flipX)
			normal.x *= -1.0;

		vec3 diffuseSample = prem(normal, 1.0, u_rotation); // diffuse part uses normal vector (no reflection)

		if(u_useDiffuseSH)
			diffuseSample = ComputeSHDiffuse( normal, coeffs );

		vec3 specularSample = prem(material.reflection, material.roughness, u_rotation);

		vec3 F = FresnelSchlickRoughness(NdotV, material.f0, material.roughness);

		if(u_renderDiffuse)
			Fd += diffuseSample * material.diffuseColor;
		if(u_renderSpecular)
			Fr += specularSample * (F * brdf.x + brdf.y) * u_SpecScale;
	}

	void applyIndirectLighting(inout PBRMat material, inout vec3 color)
	{
		// INDIRECT LIGHT: IBL ********************

		vec3 Fd_i = vec3(0.0);
		vec3 Fr_i = vec3(0.0);
		getIBLContribution(material, Fd_i, Fr_i);
		
		// CLEAT COAT LOBE ************************
		if(material.clearCoat > 0.0)
		{
			vec3 Fd_clearCoat = vec3(0.0);
			vec3 Fr_clearCoat = vec3(0.0);

			PBRMat clearCoat_material = material;
			clearCoat_material.roughness = material.clearCoatRoughness;

			float Fcc = F_Schlick(material.NoV, 0.04) * material.clearCoat;

			if(u_properties_array1.w != 0.) {
				vec3 coat_bump = texture2D( u_height_texture, v_coord ).xyz;
				coat_bump = normalize( perturbNormal( material.reflection, -material.V, v_coord, coat_bump ) );

				float coatNoV = clamp(dot(coat_bump, material.V), 0.0, 0.99) + 1e-6;
				Fcc = F_Schlick(coatNoV, 0.04) * material.clearCoat;

				// update reflection in clear coat mat
				clearCoat_material.reflection = reflect(- material.V, coat_bump);
			}

			getIBLContribution(clearCoat_material, Fd_clearCoat, Fr_clearCoat);

			// attenuate base layer for energy compensation
			Fd_i  *= (1.0 - Fcc); 

			// add specular coat layer
			Fr_i *= sq(1.0 - Fcc);
			Fr_i += Fr_clearCoat * Fcc;

			// apply tint
			Fr_i *= mix(vec3(1.0), u_tintColor, material.clearCoat);
		}

		vec3 indirect = Fd_i + Fr_i;
		
		// Apply baked ambient oclusion 
		if(u_properties_array1.z != 0. && u_enable_ao)
			indirect *= texture2D(u_ao_texture, v_coord).r;
		
		color  =   indirect * u_ibl_scale;
	}

	void main() {
        
		vec3 color;
		float alpha = u_alpha;

		// fill sh color
		coeffs.c[0] = u_sh_coeffs[0];
		coeffs.c[1] = u_sh_coeffs[1];
		coeffs.c[2] = u_sh_coeffs[2];
		coeffs.c[3] = u_sh_coeffs[3];
		coeffs.c[4] = u_sh_coeffs[4];
		coeffs.c[5] = u_sh_coeffs[5];
		coeffs.c[6] = u_sh_coeffs[6];
		coeffs.c[7] = u_sh_coeffs[7];
		coeffs.c[8] = u_sh_coeffs[8];

		PBRMat material;
		createMaterial( material );

		/*
		MATERIAL   = 0;
		WIREFRAME  = 1;
		SOLID      = 2;
		ROUGHNESS  = 3;
		METALNESS  = 4;
		NORMAL     = 5;
		*/

		if(u_render_mode < 2)
		{
			if(u_properties_array1.y != 0.)
				alpha *= texture2D(u_opacity_texture, v_coord).r;
			else
				alpha *= texture2D( u_albedo_texture, v_coord ).a;

			if(alpha < u_alpha_cutoff)
			discard;

			applyIndirectLighting( material, color);

			vec3 emissiveColor = texture2D(u_emissive_texture, v_coord).rgb;

			if(u_properties_array1.x != 0.)
				color += pow(emissiveColor, vec3(2.2)) * u_emissiveScale;
		}

		else if(u_render_mode == 2)
			color = vec3( 0.25 + clamp( dot(material.N, vec3(0.5, 0.4, 0.1)), 0.0, 1.0 ) );
		else if(u_render_mode == 3)
			color = vec3(material.roughness);
		else if(u_render_mode == 4)
			color = vec3(material.metallic);
		else if(u_render_mode == 5)
			color = vec3(material.N);

		// Save space in g-buffers
		vec2 ViewNormal = (u_view * vec4(material.N, 0.0)).xy;

		// Pbr color
		gl_FragData[0] = vec4( vec3(color), alpha);
		gl_FragData[1] = vec4( ViewNormal * 0.5 + vec2(0.5), material.metallic, material.roughness); 
		gl_FragData[2] = vec4( material.baseColor, material.clearCoat);
		//gl_FragData[3] = vec4( clearCoatRoughness, anisotropy ...);
	}

\toLinear.fs

	precision highp float;
	uniform sampler2D u_shadowmap_texture;
	uniform float u_near;
	uniform float u_far;
	uniform bool u_linearize;

	varying vec2 v_coord;

	void main()
	{
		float z = texture2D( u_shadowmap_texture, v_coord ).r;
		float linearDepth = z;

		if(u_linearize)
			linearDepth = u_near * (z + 1.0) / (u_far + u_near - z * (u_far - u_near));

		gl_FragColor = vec4(vec3(linearDepth), 1.0);
	}

\pbr_light.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
    uniform vec2 u_resolution;
    uniform mat4 u_projection;
    uniform vec3 u_camera_position;
    uniform mat4 u_view;
	uniform mat4 u_invv;
	uniform mat4 u_invp;
    uniform mat4 u_invvp;
	uniform float u_near;
    uniform float u_far;
    
    uniform vec3 u_light_position;
	uniform vec3 u_light_color;
	uniform float u_light_intensity;
	uniform vec3 u_light_direction;
	uniform vec2 u_light_angle;
	uniform float u_att_type;
	uniform vec2 u_att_info;

	uniform bool u_receive_shadows;
	uniform vec4 u_shadow_params;
	uniform mat4 u_light_matrix;

	uniform sampler2D u_color_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_depth_texture;
	uniform sampler2D u_matInfo_texture;
	uniform sampler2D u_shadowmap_texture;

    varying vec2 v_coord;
    
    #define RECIPROCAL_PI 0.3183098861837697
	#define PI 3.14159265359
    #define RECIPROCAL_PI 0.3183098861837697

	float real_depth 	= 0.0;
	float SHADOW 		= 0.0;
	float NO_SHADOW 	= 1.0;

	#import "lightShadows.inc"
	#import "matrixOp.inc"

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
    
    vec3 getPositionFromDepth(float depth) {
       
        depth = depth * 2.0 - 1.0;
        vec2 pos2D = v_coord * 2.0 - vec2(1.0);
        vec4 pos = vec4( pos2D, depth, 1.0 );
        pos = u_invvp * pos;
        pos.xyz = pos.xyz / pos.w;

        return pos.xyz;
    }

    // Fresnel effect: Specular F using Schlick approximation
    // f0 is the specular reflectance at normal incident angle
    float F_Schlick (const in float VoH, const in float f0, const in float f90) {
        return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
    }

    // Diffuse Reflections: Disney BRDF using retro-reflections using F term
    float Fd_Burley (const in float NoV, const in float NoL, const in float LoH, const in float linearRoughness) {
        float f90 = 0.5 + 2.0 * linearRoughness * LoH * LoH;
        float lightScatter = F_Schlick(NoL, 1.0, f90);
        float viewScatter  = F_Schlick(NoV, 1.0, f90);
        return lightScatter * viewScatter * RECIPROCAL_PI;
    }

    // Normal Distribution Function (NDC) using GGX Distribution
	float D_GGX (const in float NoH, const in float linearRoughness ) {
		float a2 = linearRoughness * linearRoughness;
		float f = (NoH * a2 - NoH) * NoH + 1.0;
		return a2 / (PI * f * f);
	}
    
    // Geometry Term : Geometry masking / shadowing due to microfacets
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float NdotV, float NdotL, float linearRoughness){
		float k = linearRoughness / 2.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}
    
    // Fresnel term with scalar optimization(f90=1)
	vec3 F_Schlick (const in float VoH, const in vec3 f0) {
		float f = pow(1.0 - VoH, 5.0);
		return f0 + (vec3(1.0) - f0) * f;
	}

	// Visibility term (Kelemen) for Clear coat
	float V_Kelemen (const in float LoH ) {
		return 0.25 / (LoH * LoH);
	}

	float specularClearCoat( float roughness, float NoH, float LoH) {

		float cc = 1.0;

		float D = D_GGX( roughness, NoH );
		float V = V_Kelemen( LoH ); // G -> geometry/visibility function
		float F = F_Schlick( LoH, 0.04, 1.0 ) * cc; // 0.04 is the f0 for IOR = 1.5

		return (D * V) * F;
	}

    vec3 specularBRDF( float a, float NoH, float NoV, float NoL, float LoH, vec3 f0 ) {

		// Normal Distribution Function
		float D = D_GGX( NoH, a );

		// Visibility Function (shadowing/masking)
		float V = G_Smith( NoV, NoL, a );
		
		// Fresnel
		vec3 F = F_Schlick( LoH, f0 );

		vec3 spec = (D * V) * F;
		spec /= (4.0 * NoL * NoV + 1e-6);

		return spec;
	}

	float pixelShadow( vec2 uv )
	{
		float sampleDepth = texture2D(u_shadowmap_texture, uv).r;
		sampleDepth = (sampleDepth == 1.0) ? 1.0e9 : sampleDepth; //on empty data send it to far away

		if (sampleDepth > 0.0) 
			return real_depth > sampleDepth ? SHADOW : NO_SHADOW;
		return SHADOW;
	}

	float testShadow( vec3 pos )
	{
		vec4 light_coord = u_light_matrix * vec4(pos, 1.0); // homogeneous space

		float texsize = 1.0 / u_shadow_params.x;
		float bias = u_shadow_params.y;

		vec2 sample_shadow;
		
		#if LIGHT_TYPE == 1 // omni

			vec3 l_vector = (pos - u_light_position);
			float dist = length(l_vector);
			float pixel_z = VectorToDepthValue( l_vector );
			if(pixel_z >= 0.998)
				return NO_SHADOW; //fixes a little bit the far edge bug
			
			sample_shadow = vec3ToCubemap2D( l_vector/dist );
			vec4 depth_color = texture2D( u_shadowmap_texture, sample_shadow );
			float ShadowVec = depth_color.r;
			if ( ShadowVec > pixel_z - bias )
				return NO_SHADOW;
			return SHADOW;
		#endif

		sample_shadow = (light_coord.xy / light_coord.w) * 0.5 + vec2(0.5);

		// outside of shadowmap, no shadow
		if (clamp(sample_shadow, 0.0, 1.0) != sample_shadow)
		{
			#if LIGHT_TYPE == 3 // directional -> no_shadow when leaving frustum
				return NO_SHADOW;
			#endif

			return SHADOW;	
		}

		// depth of mesh pixel
		real_depth = (light_coord.z - bias) / light_coord.w; // to clip
		real_depth = real_depth * 0.5 + 0.5;   // [-1..+1] to [0..+1]
		
		if(real_depth < 0.0 || real_depth > 1.0)
			return NO_SHADOW;

		vec2 topleft_uv = sample_shadow * texsize;
		vec2 offset_uv = fract( topleft_uv );
		offset_uv.x = expFunc(offset_uv.x);
		offset_uv.y = expFunc(offset_uv.y);
		topleft_uv = floor(topleft_uv) * u_shadow_params.x;
		float topleft = pixelShadow( topleft_uv );
		float topright = pixelShadow( topleft_uv + vec2(u_shadow_params.x,0.0) );
		float bottomleft = pixelShadow( topleft_uv + vec2(0.0, u_shadow_params.x) );
		float bottomright = pixelShadow( topleft_uv + vec2(u_shadow_params.x, u_shadow_params.x) );
		float top = mix( topleft, topright, offset_uv.x );
		float bottom = mix( bottomleft, bottomright, offset_uv.x );
		return mix( top, bottom, offset_uv.y );
	}

	float computeAttenuation( float light_dist )
	{
		//directional light
		#if LIGHT_TYPE == 3
		return 1.0;
		#endif

		//no attenuation
		if(u_att_type == 0.0)
			return 1.0;
		else if( u_att_type == 1.0 )
		{
			/*float light_radius = 200.0;
			float falloff = 1.0 - pow((light_dist/light_radius), 4.0);
			falloff *= falloff;
			falloff /= (light_dist*light_dist + 1.0);
			return falloff;*/
			return 1./light_dist;
			
		}
		else if( u_att_type == 2.0 )
		{
			if(light_dist >= u_att_info.y)
				return 0.0;
			if(light_dist >= u_att_info.x)
				return 1.0 - (light_dist - u_att_info.x) / (u_att_info.y - u_att_info.x);
		}
		return 1.0;
	}

	void main() {
		
		vec4 colorMap = texture2D( u_color_texture, v_coord );
		vec4 depthMap = texture2D( u_depth_texture, v_coord);
        vec4 normalMap = texture2D( u_normal_texture, v_coord);
        vec4 matInfoMap = texture2D( u_matInfo_texture, v_coord);
       
        // Properties
		float depth = texture2D( u_depth_texture, v_coord ).x;
		bool FarAway = false;

		// Reconstruct normal from view space
		vec2 ViewNormal = normalMap.xy * 2.0 - vec2(1.0);
		vec3 reconstructedNormal;
		reconstructedNormal.xy = ViewNormal;
		reconstructedNormal.z = sqrt(1.0 + dot(ViewNormal, -ViewNormal));
		vec3 WorldNormal = (vec4(reconstructedNormal, 0.0) * u_view ).xyz;

		float fallOf = 1.0;

        // Vectors
        vec3 p = getPositionFromDepth(depth);
		vec3 n = normalize(WorldNormal);
		vec3 v = normalize(u_camera_position - p);
		vec3 l = normalize(u_light_position - p);

		#if LIGHT_TYPE == 2 // SPOT
			fallOf = spotFalloff(normalize(u_light_direction), l, u_light_angle.x, u_light_angle.y);
		#elif LIGHT_TYPE == 3 // DIRECTIONAL
			l = normalize(u_light_direction);
		#endif

        vec3 h = normalize(v + l);

        float NoV = clamp(dot(n, v), 0.0, 0.9999) + 1e-6;
		float NoL = clamp(dot(n, l), 0.0, 0.9999) + 1e-6;
		float NoH = clamp(dot(n, h), 0.0, 0.9999) + 1e-6;
		float LoH = clamp(dot(l, h), 0.0, 0.9999) + 1e-6;
		float VoH = clamp(dot(v, h), 0.0, 0.9999) + 1e-6;
        
        // Mat
		float metallic = normalMap.b;
        float roughness = normalMap.a;
		float linearRoughness = roughness * roughness;
		vec3 baseColor = matInfoMap.rgb;
		vec3 f0 = baseColor * metallic + (vec3(0.5) * (1.0 - metallic));
        vec3 diffuseColor = (1.0 - metallic) * baseColor;
        
        // Compose
		vec3 Fd_d = diffuseColor * RECIPROCAL_PI;//* Fd_Burley (NoV, NoL, LoH, linearRoughness);
        vec3 Fr_d = specularBRDF( linearRoughness, NoH, NoV, NoL, LoH, f0 );

		// Clear coat lobe
		float cc = matInfoMap.a;
		float cc_r = 0.2;
		vec3 Frc = specularBRDF( cc_r, NoH, NoV, NoL, LoH, f0 );
		Fr_d = mix(Fr_d, Frc, cc);

		vec3 direct = (Fd_d + Fr_d) * NoL;

        // COMPOSE
		vec3 color = vec3(0.0);
		float intensity = u_light_intensity * 5.0;
		vec3 lightParams = u_light_color * intensity * fallOf;
		vec3 lit =  direct * lightParams;

		if(u_receive_shadows)
		lit *= testShadow( p );

		float dist = length( u_light_position - p );
		color += lit * computeAttenuation( dist );

		// do not add light when depth = 1.0
		if(FarAway)
		color = vec3(0.0);

		// add light to pbr color
		gl_FragColor = vec4(vec3(color), 1.0);
	}

\grid.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	void main() {

		vec4 color = u_color; 
		
		if( abs(v_wPosition.x) < 0.1 ) 
			color = mix(vec4(0.4,0.4,1.0,0.5),color,abs(v_wPosition.x/0.1)); 
			
		if( abs(v_wPosition.z) < 0.1 ) 
			color = mix(vec4(1.0,0.4,0.4,0.5),color,abs(v_wPosition.z/0.1)); 

		// no normal data			
		gl_FragColor = vec4(color.rgb, 0.85);
	}

\lines.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	void main() {

		vec4 color = u_color;
		// no normal data			
		gl_FragData[0] = color;
	}


\chroma.vs


	precision highp float;
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

		gl_Position = u_mvp * vec4(a_vertex,1.0);
	}

\chroma.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable
	#extension GL_EXT_draw_buffers : require
	
	precision highp float;
	varying vec2 v_coord;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;

	uniform sampler2D u_chroma_texture;
	uniform sampler2D u_normal_texture;

	uniform vec3 u_camera_position;
	uniform float u_balance;
	uniform vec4 u_key_color;
	uniform vec4 u_fake_bounce;
	uniform float u_luminance_mask_power;
	uniform float u_despill_amount;
	uniform float _despill_threshold;
	uniform bool u_enable_despill;
	uniform bool u_enable_chroma;
	
	uniform bool u_applyShading;
	uniform bool u_hasChromaNormalTexture;

	uniform float u_rotation;
	uniform float u_chroma_ibl_intensity;
	uniform float u_light_intensity;
	uniform vec3 u_light_color;
	uniform vec3 u_light_position;

	uniform samplerCube u_SpecularEnvSampler_texture;

	const float PI = 3.14159265359; 

	#import "bump.inc"

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

	vec3 V, R, L, N, pN;

	vec3 rotateVector(vec3 v, float angle)
	{
		vec3 axis = vec3(0.0,1.0,0.0);
		float s = sin(angle);                                                                                                                          
		float c = cos(angle);
		float oc = 1.0 - c;

		mat4 mat =  mat4(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,0.0,
		oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,0.0,
		oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c,0.0,
		0.0,0.0,0.0,1.0);

		return (mat * vec4(v,1.0)).xyz;
	}

	vec3 getPhong()
	{
		V = normalize(u_camera_position - v_wPosition);
		N = normalize(v_wNormal);

		if(u_hasChromaNormalTexture) 
			pN = perturbNormal(N, V, v_coord, texture2D(u_normal_texture, v_coord).rgb);
		else
			pN = N;

		// update Y 
		pN.y = -pN.y;

		R = reflect(V, pN);		

		vec3 ambient = vec3(0.1, 0.1, 0.1);

		// vec3 L = u_lightvector; 
		vec3 L_pos = u_light_position;
		L = normalize(L_pos - v_wPosition);

		// plane normal!
		float f = max(0.0, dot(L,N));

		vec3 Lcolor = u_light_color;

		vec3 R_L = reflect(-L, pN);  
		float NoL = max(0.0, dot(L,pN));

		vec3 Diffuse = vec3(NoL) * /* Id */ 1.0;
		vec3 Specular = vec3(pow( clamp(dot(R_L,V),0.001,1.0), 1.0 )) * /* Is */ 1.0;

		vec3 Vec = rotateVector(R, u_rotation);
		vec3 IndirectDiffuse = textureCubeLodEXT(u_SpecularEnvSampler_texture, Vec, 4.0).rgb;// * max(0.,dot(-R, N));

		return 	ambient + 
				(Diffuse + Specular) * Lcolor * u_light_intensity + 
				IndirectDiffuse * u_chroma_ibl_intensity;
	}

	void main() {

		// https://www.unrealengine.com/en-US/tech-blog/setting-up-a-chroma-key-material-in-ue4

		// Color extraction

		vec3 source = texture2D(u_chroma_texture, v_coord).rgb;

		if(!u_enable_chroma)
		{
			source = pow(source, vec3(2.2));
			gl_FragData[0] = vec4(vec3(source), 1.0);
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
			finalColor += (pixelSat * u_fake_bounce.rgb * despillMask);   
			finalColor = clamp(finalColor, 0.0, 1.0);
		}

		// Undo the gamma correction in the previous render step
		finalColor = pow(finalColor, vec3(2.2));

		vec3 Phong = getPhong();

		if(u_applyShading)
			finalColor *= Phong;
		
		// discard translucid pixels
		if(alpha > 0.1)
			alpha = 1.0;

		gl_FragData[0] = vec4(finalColor.rgb, alpha);
	}

\skinning.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;
	varying vec3 v_pos;
	varying vec3 v_normal;
	varying vec2 v_coord;
	uniform mat4 u_model;
	uniform mat4 u_viewprojection;
	attribute vec4 a_bone_indices;
	attribute vec4 a_weights;
	uniform mat4 u_bones[64];

	void computeSkinning(inout vec3 vertex, inout vec3 normal)
	{
		vec4 v = vec4(vertex,1.0);
		vertex = (u_bones[int(a_bone_indices.x)] * a_weights.x * v + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * v + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * v + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * v).xyz;
		vec4 N = vec4(normal,0.0);
		normal =	(u_bones[int(a_bone_indices.x)] * a_weights.x * N + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * N + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * N + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * N).xyz;
		normal = normalize(normal);
	}

	void main() {
		vec3 vertex = a_vertex;
		vec3 normal = a_normal;
		computeSkinning(vertex,normal);
		v_pos = (u_model * vec4(vertex,1.0)).xyz;
		v_normal = (u_model * vec4(normal,0.0)).xyz;
		v_coord = a_coord;
		gl_Position = u_viewprojection * vec4( v_pos , 1.0 );
	}

\skinning.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	uniform vec4 u_color;
	uniform sampler2D u_color_texture;
	varying vec2 v_coord;
	void main() {
		gl_FragData[0] = u_color * texture2D(u_color_texture,v_coord);
		
	}

\SH.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_uv;
	attribute vec4 a_color;

	uniform vec3 u_camera_pos;

	uniform mat4 u_model;
	uniform mat4 u_viewprojection;

	//this will store the color for the pixel shader
	varying vec3 v_position;
	varying vec3 v_world_position;
	varying vec3 v_normal;
	varying vec2 v_uv;
	varying vec4 v_color;

	void main()
	{	
		//calcule the normal in camera space (the NormalMatrix is like ViewMatrix but without traslation)
		v_normal = (u_model * vec4( a_normal, 0.0) ).xyz;
		
		//calcule the vertex in object space
		v_position = a_vertex;
		v_world_position = (u_model * vec4( v_position, 1.0) ).xyz;
		
		//store the color in the varying var to use it from the pixel shader
		v_color = a_color;

		//store the texture coordinates
		v_uv = a_uv;

		//calcule the position of the vertex using the matrices
		gl_Position = u_viewprojection * vec4( v_world_position, 1.0 );
	}

\SH.fs

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_position;
	varying vec3 v_world_position;
	varying vec3 v_normal;
	varying vec2 v_uv;

	uniform vec3 u_sh_coeffs[9];
	uniform bool u_flipX;

	#import "sh.inc"

	void main()
	{
		vec3 normal = -normalize( v_normal );

		SH9Color coeffs;
		coeffs.c[0] = u_sh_coeffs[0];
		coeffs.c[1] = u_sh_coeffs[1];
		coeffs.c[2] = u_sh_coeffs[2];
		coeffs.c[3] = u_sh_coeffs[3];
		coeffs.c[4] = u_sh_coeffs[4];
		coeffs.c[5] = u_sh_coeffs[5];
		coeffs.c[6] = u_sh_coeffs[6];
		coeffs.c[7] = u_sh_coeffs[7];
		coeffs.c[8] = u_sh_coeffs[8];

		if(u_flipX)
			normal.x = -normal.x;

		vec3 irradiance = ComputeSHDiffuse( normal, coeffs );

		gl_FragData[0] =  vec4(max( vec3(0.001), irradiance ), 1.0 );
	}

\sh.inc

	const float Pi = 3.141592654;
	const float CosineA0 = Pi;
	const float CosineA1 = (2.0 * Pi) / 3.0;
	const float CosineA2 = Pi * 0.25;

	struct SH9
	{
		float c[9];
	};

	struct SH9Color
	{
		vec3 c[9];
	};

	/*void fillSH9Color(out SH9 sh, vec3 coeffs[])
	{

	}*/

	void SHCosineLobe(in vec3 dir, out SH9 sh)
	{
		// Band 0
		sh.c[0] = 0.282095 * CosineA0;
		
		// Band 1
		sh.c[1] = 0.488603 * dir.y * CosineA1;
		sh.c[2] = 0.488603 * dir.z * CosineA1;
		sh.c[3] = 0.488603 * dir.x * CosineA1;
		
		// Band 2
		#ifndef SH_LOW
		
		sh.c[4] = 1.092548 * dir.x * dir.y * CosineA2;
		sh.c[5] = 1.092548 * dir.y * dir.z * CosineA2;
		sh.c[6] = 0.315392 * (3.0 * dir.z * dir.z - 1.0) * CosineA2;
		sh.c[7] = 1.092548 * dir.x * dir.z * CosineA2;
		sh.c[8] = 0.546274 * (dir.x * dir.x - dir.y * dir.y) * CosineA2;
		#endif
		
	}

	vec3 ComputeSHDiffuse(in vec3 normal, in SH9Color radiance)
	{
		// Compute the cosine lobe in SH, oriented about the normal direction
		SH9 shCosine;
		SHCosineLobe(normal, shCosine);

		// Compute the SH dot product to get irradiance
		vec3 irradiance = vec3(0.0);
		#ifndef SH_LOW
		const int num = 9;
		#else
		const int num = 4;
		#endif
		
		for(int i = 0; i < num; ++i)
			irradiance += radiance.c[i] * shCosine.c[i];
		
		vec3 shDiffuse = irradiance * (1.0 / Pi);

		return irradiance;
	}

\matrixOp.inc

	vec3 world2view( vec3 a ){ return  (u_view * vec4(a,1.0)).xyz; }
	vec3 view2world( vec3 a ){ return (u_invv * vec4(a,1.0)).xyz; }
	vec3 view2screen( vec3 a){ return  (u_projection * vec4(a,1.0)).xyz; }
	vec3 screen2view( vec3 a){ return (u_invp * vec4(a,1.0)).xyz; }

\pbr_brdf.inc

	#define GAMMA 2.2
	#define PI 3.14159265359
	#define RECIPROCAL_PI 0.3183098861837697
	#define MAX_REFLECTANCE 0.16
	#define MIN_REFLECTANCE 0.04
	#define MIN_PERCEPTUAL_ROUGHNESS 0.045
	#define MIN_ROUGHNESS            0.002025
	#define MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS 0.6

	#define MEDIUMP_FLT_MAX    65504.0
	#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)

	struct Light
	{
		float fallOf;
		vec3 direction;
	};	

	struct PBRMat
	{
		float linearRoughness;
		float roughness;
		float metallic;
		float alpha;
		float f90;
		vec3 f0;
		vec3 reflectance;
		vec3 baseColor;
		vec3 diffuseColor;
		vec3 specularColor;
		vec3 reflection;
		vec3 N;
		vec3 V;
		vec3 H;
		float NoV;
		float NoL;
		float NoH;
		float LoH;
		float VoH;
		Light light;
		float clearCoat;
		float clearCoatRoughness;
		float clearCoatLinearRoughness;
		float anisotropy;
		vec3 anisotropicT;
		vec3 anisotropicB;
		mat3 tangentToWorld;
	};

	float D_GGX_2(float linearRoughness, float NoH, const vec3 n, const vec3 h) {
	    vec3 NxH = cross(n, h);
	    float a = NoH * linearRoughness;
	    float k = linearRoughness / (dot(NxH, NxH) + a * a);
	    float d = k * k * (1.0 / PI);
	    return saturateMediump(d);
	}

	// Normal Distribution Function (NDC) using GGX Distribution
	float D_GGX (const in float NoH, const in float linearRoughness ) {
		
		float a2 = linearRoughness * linearRoughness;
		float f = (NoH * NoH) * (a2 - 1.0) + 1.0;
		return a2 / (PI * f * f);
		
	}

	// Geometry Term : Geometry masking / shadowing due to microfacets
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float NdotV, float NdotL, float roughness){
		
		float k = pow(roughness + 1.0, 2.0) / 8.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}

	// Geometric shadowing using Smith Geometric Shadowing function
	// Extracting visibility function V(v, l, a)
	float V_SmithGGXCorrelated(float NoV, float NoL, float linearRoughness) {
	    float a2 = linearRoughness * linearRoughness;
	    float GGXV = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
	    float GGXL = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
	    return 0.5 / (GGXV + GGXL);
	}

	// Approximation (Not correct 100% but has better performance)
	float V_SmithGGXCorrelatedFast(float NoV, float NoL, float linearRoughness) {
	    float a = linearRoughness;
	    float GGXV = NoL * (NoV * (1.0 - a) + a);
	    float GGXL = NoV * (NoL * (1.0 - a) + a);
	    return 0.5 / (GGXV + GGXL);
	}

	float Geometric_Smith_Schlick_GGX_(float a, float NdV, float NdL) {
	    // Smith schlick-GGX.
	    float k = a * 0.5;
	    float GV = NdV / (NdV * (1.0 - k) + k);
	    float GL = NdL / (NdL * (1.0 - k) + k);
	    return GV * GL;
	}

	// Visibility term (Kelemen) for Clear coat
	float V_Kelemen (const in float LoH ) {
		return 0.25 / (LoH * LoH);
	}

	// Fresnel effect: Specular F using Schlick approximation
	// f0 is the specular reflectance at normal incident angle
	float F_Schlick (const in float VoH, const in float f0, const in float f90) {
		return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
	}

	// Fresnel term with scalar optimization(f90=1)
	vec3 F_Schlick (const in float VoH, const in vec3 f0) {
		float f = pow(1.0 - VoH, 5.0);
		return f0 + (vec3(1.0) - f0) * f;
	}

	float F_Schlick (const in float VoH, const in float f0) {
		return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
	}

	// Diffuse Reflections: Lambertian BRDF
	float Fd_Lambert() {
		return RECIPROCAL_PI;
	}

	// Diffuse Reflections: Disney BRDF using retro-reflections using F term
	float Fd_Burley (const in float NoV, const in float NoL, const in float LoH, const in float linearRoughness) {
		float f90 = 0.5 + 2.0 * linearRoughness * LoH * LoH;
		float lightScatter = F_Schlick(NoL, 1.0, f90);
		float viewScatter  = F_Schlick(NoV, 1.0, f90);
		return lightScatter * viewScatter * RECIPROCAL_PI;
	}

	float sq(float x) {
	    return x * x;
	}

	float max3(const vec3 v) {
	    return max(v.x, max(v.y, v.z));
	}

	float iorToF0 (float transmittedIor, float incidentIor) {
	    return sq((transmittedIor - incidentIor) / (transmittedIor + incidentIor));
	}

	float f0ToIor(float f0) {
	    float r = sqrt(f0);
	    return (1.0 + r) / (1.0 - r);
	}

	vec3 computeDielectricF0(vec3 reflectance) {
	    return MAX_REFLECTANCE * reflectance * reflectance;
	}

	vec3 f0ClearCoatToSurface(const vec3 f0, float ior) {

		return vec3( clamp(iorToF0(  f0ToIor(f0.x), ior ), 0.0, 1.0),
					clamp(iorToF0(  f0ToIor(f0.y), ior ), 0.0, 1.0),
					clamp(iorToF0(  f0ToIor(f0.z), ior ), 0.0, 1.0) );
	}

	vec3 computeDiffuseColor(vec3 baseColor, float metallic) {
	
		return (1.0 - metallic) * baseColor;
	}

	vec3 computeF0(const vec3 baseColor, float metallic, vec3 reflectance) {
	    // return baseColor * metallic + (reflectance * (1.0 - metallic));
		return mix(vec3(0.04) * reflectance, baseColor, metallic);
	}

	float rand(vec2 co)  {
		return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
	}

	float specularClearCoat( const PBRMat material, inout float Fc) {

		float D = D_GGX( material.clearCoatLinearRoughness, material.NoH );
		float V = V_Kelemen( material.LoH );
		Fc = F_Schlick( material.LoH, 0.04, 1.0 ) * material.clearCoat; // 0.04 is the f0 for IOR = 1.5

		return (D * V) * Fc;
	}

	vec3 specularBRDF( const in PBRMat material ) {

		// Normal Distribution Function
		float D = D_GGX( material.NoH, material.linearRoughness );

		// Visibility Function (shadowing/masking)
		float V = G_Smith( material.NoV, material.NoL, material.roughness );
		
		// Fresnel
		vec3 F = F_Schlick( material.LoH, material.f0 );

		vec3 spec = (D * V) * F;
		spec /= (4.0 * material.NoL * material.NoV + 1e-6);

		return spec;
	}

\bump.inc
	//Javi Agenjo Snipet for Bump Mapping

	mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv, inout vec3 t, inout vec3 b){
		// get edge vectors of the pixel triangle
		vec3 dp1 = dFdx( p );
		vec3 dp2 = dFdy( p );
		vec2 duv1 = dFdx( uv );
		vec2 duv2 = dFdy( uv );

		// solve the linear system
		vec3 dp2perp = cross( dp2, N );
		vec3 dp1perp = cross( N, dp1 );
		vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
		vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

		// construct a scale-invariant frame
		float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );

		t = T * invmax;
		b = B * invmax;

		return mat3( t, b, N );
	}

	mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv){
		// get edge vectors of the pixel triangle
		vec3 dp1 = dFdx( p );
		vec3 dp2 = dFdy( p );
		vec2 duv1 = dFdx( uv );
		vec2 duv2 = dFdy( uv );

		// solve the linear system
		vec3 dp2perp = cross( dp2, N );
		vec3 dp1perp = cross( N, dp1 );
		vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
		vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

		// construct a scale-invariant frame
		float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
		return mat3( T * invmax, B * invmax, N );
	}

	vec3 perturbNormal( mat3 TBN, vec3 normal_pixel ){
	
		normal_pixel = normal_pixel * 255./127. - 128./127.;
		return normalize(TBN * normal_pixel);
	}

	vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
	
		// assume N, the interpolated vertex normal and
		// V, the view vector (vertex to eye)
		normal_pixel = normal_pixel * 255./127. - 128./127.;
		mat3 TBN = cotangent_frame(N, V, texcoord);
		return normalize(TBN * normal_pixel);
	}

\fresnel.inc
	
	//  Spherical Gaussian approximation
	vec3 fresnelSchlick(vec3 F0, float LdotH)
	{
		float power = (-5.55473 * LdotH - 6.98316) * LdotH;
		return F0 + (vec3(1.0) - F0) * pow(2.0, power);
	}

	// Shlick's approximation of the Fresnel factor.
	vec3 fresnelGDC(vec3 F0, float val)
	{
		return F0 + (vec3(1.0) - F0) * pow( (1.0 - val) , 5.0);
	}

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {
	
		float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );
		return ( 1.0 - specularColor ) * fresnel + specularColor;
	} 

\lightShadows.inc

	float spotFalloff(vec3 spotDir, vec3 lightDir, float angle_phi, float angle_theta) {
			
		float sqlen = dot(lightDir,lightDir);
		float atten = 1.0;
		
		vec4 spotParams = vec4( cos(angle_phi/2.), cos(angle_theta/2.), 1.0, 0.0 );
		spotParams.w = 1.0 / (spotParams.x-spotParams.y);
		
		vec3 dirUnit = lightDir * sqrt(sqlen); //we asume they are normalized
		float spotDot = dot(spotDir, dirUnit);
		if (spotDot <= spotParams.y)// spotDot <= cos phi/2
			return 0.0;
		else if (spotDot > spotParams.x) // spotDot > cos theta/2
			return 1.0;
		
		// vertex lies somewhere beyond the two regions
		float ifallof = pow( (spotDot-spotParams.y)*spotParams.w,spotParams.z );
		return ifallof;
	}

	float UnpackDepth(vec4 depth, bool color)
	{
		if(color)
		{
			const vec4 bitShift = vec4( 1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0 );
			return dot(depth, bitShift);
		}
		else
			return depth.x;
	}

	float expFunc(float f)
	{
		return f*f*f*(f*(f*6.0-15.0)+10.0);
	}

	float VectorToDepthValue(vec3 Vec)
	{
		vec3 AbsVec = abs(Vec);
		float LocalZcomp = max(AbsVec.x, max(AbsVec.y, AbsVec.z));
		float n = u_shadow_params.z;
		float f = u_shadow_params.w;
		float NormZComp = (f+n) / (f-n) - (2.0*f*n)/(f-n)/LocalZcomp;
		return (NormZComp + 1.0) * 0.5;
	}

	vec2 vec3ToCubemap2D( vec3 v )
	{
		vec3 abs_ = abs(v);
		float max_ = max(max(abs_.x, abs_.y), abs_.z); // Get the largest component
		vec3 weights = step(max_, abs_); // 1.0 for the largest component, 0.0 for the others
		float sign_ = dot(weights, sign(v)) * 0.5 + 0.5; // 0 or 1
		float sc = dot(weights, mix(vec3(v.z, v.x, -v.x), vec3(-v.z, v.x, v.x), sign_));
	    float tc = dot(weights, mix(vec3(-v.y, -v.z, -v.y), vec3(-v.y, v.z, -v.y), sign_));
	    vec2 uv = (vec2(sc, tc) / max_) * 0.5 + 0.5;
		// Offset into the right region of the texture
		float offsetY = dot(weights, vec3(1.0, 3.0, 5.0)) - sign_;
		uv.y = (uv.y + offsetY) / 6.0;
		return uv;
	}

\inverse.inc

	mat2 inverse(mat2 m) {
	return mat2(m[1][1],-m[0][1],
				-m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
	}

	mat3 inverse(mat3 m) {
	float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
	float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
	float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

	float b01 = a22 * a11 - a12 * a21;
	float b11 = -a22 * a10 + a12 * a20;
	float b21 = a21 * a10 - a11 * a20;

	float det = a00 * b01 + a01 * b11 + a02 * b21;

	return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
				b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
				b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
	}     

	mat4 inverse( mat4 A ) {

	float s0 = A[0][0] * A[1][1] - A[1][0] * A[0][1];
	float s1 = A[0][0] * A[1][2] - A[1][0] * A[0][2];
	float s2 = A[0][0] * A[1][3] - A[1][0] * A[0][3];
	float s3 = A[0][1] * A[1][2] - A[1][1] * A[0][2];
	float s4 = A[0][1] * A[1][3] - A[1][1] * A[0][3];
	float s5 = A[0][2] * A[1][3] - A[1][2] * A[0][3];

	float c5 = A[2][2] * A[3][3] - A[3][2] * A[2][3];
	float c4 = A[2][1] * A[3][3] - A[3][1] * A[2][3];
	float c3 = A[2][1] * A[3][2] - A[3][1] * A[2][2];
	float c2 = A[2][0] * A[3][3] - A[3][0] * A[2][3];
	float c1 = A[2][0] * A[3][2] - A[3][0] * A[2][2];
	float c0 = A[2][0] * A[3][1] - A[3][0] * A[2][1];

	float invdet = 1.0 / (s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0);

	mat4 B;

	B[0][0] = ( A[1][1] * c5 - A[1][2] * c4 + A[1][3] * c3) * invdet;
	B[0][1] = (-A[0][1] * c5 + A[0][2] * c4 - A[0][3] * c3) * invdet;
	B[0][2] = ( A[3][1] * s5 - A[3][2] * s4 + A[3][3] * s3) * invdet;
	B[0][3] = (-A[2][1] * s5 + A[2][2] * s4 - A[2][3] * s3) * invdet;

	B[1][0] = (-A[1][0] * c5 + A[1][2] * c2 - A[1][3] * c1) * invdet;
	B[1][1] = ( A[0][0] * c5 - A[0][2] * c2 + A[0][3] * c1) * invdet;
	B[1][2] = (-A[3][0] * s5 + A[3][2] * s2 - A[3][3] * s1) * invdet;
	B[1][3] = ( A[2][0] * s5 - A[2][2] * s2 + A[2][3] * s1) * invdet;

	B[2][0] = ( A[1][0] * c4 - A[1][1] * c2 + A[1][3] * c0) * invdet;
	B[2][1] = (-A[0][0] * c4 + A[0][1] * c2 - A[0][3] * c0) * invdet;
	B[2][2] = ( A[3][0] * s4 - A[3][1] * s2 + A[3][3] * s0) * invdet;
	B[2][3] = (-A[2][0] * s4 + A[2][1] * s2 - A[2][3] * s0) * invdet;

	B[3][0] = (-A[1][0] * c3 + A[1][1] * c1 - A[1][2] * c0) * invdet;
	B[3][1] = ( A[0][0] * c3 - A[0][1] * c1 + A[0][2] * c0) * invdet;
	B[3][2] = (-A[3][0] * s3 + A[3][1] * s1 - A[3][2] * s0) * invdet;
	B[3][3] = ( A[2][0] * s3 - A[2][1] * s1 + A[2][2] * s0) * invdet;

	return B;
	}    
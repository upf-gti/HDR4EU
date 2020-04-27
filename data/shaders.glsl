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
filter_diffuse defblur.vs filter_diffuse.fs
filter_specular defblur.vs filter_specular.fs
mirror default.vs mirroredSphere.fs
diffCubemap screen_shader.vs diffCubemap.fs

// Texture FX Shaders

chroma chroma.vs chroma.fs
glow screen_shader.vs glow.fs
maxLum screen_shader.vs maxLum.fs
luminance screen_shader.vs luminance.fs

// Deferred rendering Shaders
ssao screen_shader.vs ssao.fs
multiplyPass screen_shader.vs multiplyPass.fs
DeferredCubemap default.vs DeferredCubemap.fs
linearDepth screen_shader.vs linearDepth.fs

// PBR and SH
pbr testpbr.vs testpbr.fs
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
		hdr.rgb *= pow(vec3(2.), vec3(u_hdr_scale));

		// get pixel luminance
		hdr.a = log(luminance(hdr.rgb) + 1e-6);

		gl_FragColor = hdr;
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

//
// Default fragment shader 
//

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

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform vec3 u_camera_position;
	uniform vec3 u_lightcolor;
	uniform vec3 u_lightvector;
	uniform vec4 u_color;
	
	uniform float u_specular_power;
	uniform float u_specular_gloss;
	uniform float u_reflectivity;
	uniform vec3 u_ambient;

	uniform sampler2D u_albedo_texture;
	uniform samplerCube u_SpecularEnvSampler_texture;

	void applyReflection(vec3 R, inout vec4 color)
	{
		vec3 bg = textureCube(u_SpecularEnvSampler_texture, R).rgb;
		color.xyz = mix( color.xyz, bg, clamp( u_reflectivity, 0.0, 1.0) );
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
		float Gloss = max(u_specular_gloss, 1.0);

		vec3 Diffuse = vec3(abs(NdotL));
		vec3 Specular = vec3(u_specular_power * pow( clamp(dot(R,V),0.001,1.0), Gloss ));

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

		vec4 color = texture2D(u_color_texture, v_coord);

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
	uniform float u_hdr_scale;
	uniform vec4 u_WhiteBalance[16];
	uniform int u_numImages;
	varying vec2 v_coord;

	void main() {

		int refId = int(float(u_numImages) / 2.0);
		vec4 color = texture2D(u_texture, v_coord);

		color /= pow(vec4(2.0), vec4(u_hdr_scale));

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

		color = pow(color, vec4(1.0/2.2));

		gl_FragColor = color;
	}

\TestHDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	varying vec2 v_coord;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}
	
	void main() {

		vec3 color = texture2D(u_texture, v_coord).rgb;

		float logAvgLum = exp( texture2D(u_texture_mip, v_coord, 20.0).a );

		vec3 n = vec3(0.75);
		color.rgb = ((pow(color.rgb, n)) / ( pow(color.rgb, n) + pow(vec3(logAvgLum), n)));

		// color.rgb = pow(color.rgb, vec3(1.0/2.2));

		gl_FragColor = vec4(color, 1.);
	}


\ExponentialHDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	varying vec2 v_coord;

	uniform float Brightness;
	
	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}
	
	void main() {

		vec3 hdr = texture2D(u_texture, v_coord).rgb;
		/*float logAvgLum = exp( texture2D(u_texture_mip, v_coord, 20.0).a );

		float B = 0.16;

		float lum = luminance(hdr);
		float lum_TM = 1.0 - exp( -B * lum/logAvgLum );

		hdr.rgb *= lum_TM/lum;

		hdr.rgb = pow(hdr.rgb, vec3(1.0/1.8));*/

		gl_FragColor = vec4(hdr, 1.);
	}

\PTR_HDRI.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
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
		float logAvgLum = exp( texture2D(u_texture_mip, v_coord, 20.0).a );

		vec4 color = vec4(global( hdr.rgb, logAvgLum ), 1.0);
		color.rgb = pow(color.rgb, vec3(1.0/1.8));

		gl_FragColor = color * u_PostExposure;
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

	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	uniform vec4 u_color;
	uniform vec3 u_camera_position;
	
	uniform samplerCube u_SpecularEnvSampler_texture;

	void main() {

		vec3 E = v_wPosition - u_camera_position;
		E = normalize(E);

		// r = 2n(n · v) − v
		vec3 n = normalize(v_wNormal);

		vec3 w0 = E;
		vec3 wr = 2.0 * dot(n, w0) * n;
		wr -= w0;
		wr = normalize(wr);

		vec4 color = textureCube(u_SpecularEnvSampler_texture, wr);
		
		color = pow(color, vec4(1.0/2.2));

		gl_FragData[0] = u_color * color;
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
	uniform bool u_applyGamma;
	uniform bool u_blur;

	uniform samplerCube u_color_texture;
	uniform bool u_flipX;
	uniform bool u_is_rgbe;

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

		vec3 E = normalize(u_camera_position - v_wPosition);
		
		if(u_flipX)
			E.x = -E.x;
		
		E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

		vec4 color = textureCubeLodEXT(u_color_texture, E, u_blur ? 1.0 : 0.0);

		if(u_is_rgbe)
			color = vec4(color.rgb * pow(2.0, color.a * 255.0 - 128.0), 1.0);
		
	//	color = color / (color + vec4(1.0));
	//	color = pow(color, vec4(1.0/2.2));

		gl_FragData[0] = color;
		gl_FragData[1] = vec4((v_wNormal * 0.5 + vec3(0.5) ), 1.0); 
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

	#import "brdf.inc"

	void main() {

		vec3 N = normalize( u_rotation * v_dir );

		vec4 color = vec4(0.0);
		float TotalWeight = 0.0;
		float roughness = clamp(u_roughness, 0.0045, 0.98);
		float alphaRoughness = roughness * roughness;

		float lod = clamp(alphaRoughness * u_mipCount, 0.0, u_mipCount);

		// (gl_FragCoord.xy) / vec2(size, size) = v_coord
		const float step = 8.0;
	
		for(float i = 0.5; i < size; i+=step)
		for(float j = 0.5; j < size; j+=step) {

			// Get pixel
			vec2 r_coord = vec2(i, j) / vec2(size, size);
			// Get 3d vector
			vec3 dir = vec3( r_coord - vec2(0.5), 0.5 );
			dir.y *= -1.0;

			/*vec3 impSample = -importanceSampleGGX( r_coord, roughness, N  );
			impSample.y *= -1.0;*/

			// Use all faces
			for(int f = 0; f < 6; f++) {

				mat3 _camera_rotation = u_cameras[f];
				vec3 NF = normalize( _camera_rotation * dir );

				float weight = max(0.0, dot(N, NF));
				float pow_weight = weight * pow(weight, 64.0 * (1.0 - roughness ));

				if(weight > 0.0 ) {
					color += textureCubeLodEXT(u_color_texture, NF, lod) * pow_weight;
					TotalWeight += pow_weight;
				}
				
			}
		}

		gl_FragColor = vec4(color.rgb / TotalWeight, 1.0);
	}

\filter_diffuse.fs

	#extension GL_EXT_shader_texture_lod : enable
	precision highp float;

	uniform samplerCube u_color_texture;
	uniform sampler2D u_hammersley_sample_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 
	uniform float u_mipCount;
	
	varying vec3 v_dir;
	varying vec2 v_coord;

	#ifdef EM_SIZE
		const int target_size = EM_SIZE;
	#endif

	const float PI = 3.1415926535897932384626433832795;
	const int sampleCount = 1024;
	const float HAMMERSLEY_SIZE = 8192.0;
	vec2 jitternoise = vec2(0.0);

	/* -- Tangent Space conversion -- */
	vec3 tangent_to_world(vec3 vector, vec3 N, vec3 T, vec3 B)
	{
	  return T * vector.x + B * vector.y + N * vector.z;
	}
	float noise(vec2 co)  {
		    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}
	vec3 hammersley_3d(float i, float invsamplenbr)
	{
	  vec3 Xi; /* Theta, cos(Phi), sin(Phi) */

	  Xi.x = i * invsamplenbr; /* i/samples */
	  Xi.x = fract(Xi.x + jitternoise.x);

	  int u = int(mod(i + jitternoise.y * HAMMERSLEY_SIZE, HAMMERSLEY_SIZE));

	  Xi.yz = texture2D(u_hammersley_sample_texture, vec2(u, 0)).rg;

	  return Xi;
	}
	vec2 Hammersley(const in int index, const in int numSamples){
		vec2 r = fract(vec2(float(index) * 5.3983, float(int(int(2147483647.0) - index)) * 5.4427));
		r += dot(r.yx, r.xy + vec2(21.5351, 14.3137));
		return fract(vec2(float(index) / float(numSamples), (r.x * r.y) * 95.4337));
	}
	vec3 sample_hemisphere(float nsample, vec3 N, vec3 T, vec3 B)
	{
		vec3 Xi = vec3(
			Hammersley(int(nsample), sampleCount),
			noise(v_coord)
		);
		// Xi = hammersley_3d(nsample, float(1.0/float(sampleCount)));

	  float z = Xi.x;                         /* cos theta */
	  float r = sqrt(max(0.0, 1.0 - z * z)); /* sin theta */
	  float x = r * Xi.y;
	  float y = r * Xi.z;

	  vec3 Ht = vec3(x, y, z);

	  return tangent_to_world(Ht, N, T, B);
	}

	vec3 octahedral_to_cubemap_proj(vec2 co)
	{
	  co = co * 2.0 - 1.0;

	  vec2 abs_co = abs(co);
	  vec3 v = vec3(co, 1.0 - (abs_co.x + abs_co.y));

	  if (abs_co.x + abs_co.y > 1.0) {
	    v.xy = (abs(co.yx) - 1.0) * -sign(co.xy);
	  }

	  return v;
	}

	void make_orthonormal_basis(vec3 N, out vec3 T, out vec3 B)
	{
	  vec3 UpVector = abs(N.z) < 0.99999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
	  T = normalize(cross(UpVector, N));
	  B = cross(N, T);
	}

	vec2 noise2v(vec2 co)  {
	    return vec2(
			fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453),
			fract(sin(dot(co.yx ,vec2(12.9898,78.233))) * 43758.5453)
		);
	}

	void main() {

		const vec2 map_size = vec2(16.0);
		const vec2 texelSize = 1.0 / map_size;
		vec2 uvs = mod(v_coord, map_size) * texelSize;
		const float paddingSize = 1.0;

		/* Add a N pixel border to ensure filtering is correct
		* for N mipmap levels. */
		uvs = (uvs - texelSize * paddingSize) / (1.0 - 2.0 * texelSize * paddingSize);

		/* edge mirroring : only mirror if directly adjacent
		* (not diagonally adjacent) */
		vec2 m = abs(uvs - 0.5) + 0.5;
		vec2 f = floor(m);
		if (f.x - f.y != 0.0) {
			uvs = 1.0 - uvs;
		}

		/* clamp to [0-1] */
		uvs.x = clamp(uvs.x, 0.0, 1.0);
		uvs.y = clamp(uvs.y, 0.0, 1.0);

		/* get cubemap vector */
		vec3 cubevec = octahedral_to_cubemap_proj(uvs);

		vec3 N, T, B, V;

		N = normalize( u_rotation * v_dir );
		//N = normalize(cubevec);

		make_orthonormal_basis(N, T, B); /* Generate tangent space */
		// Setup noise (blender version)
		jitternoise = noise2v(v_coord);

		/* Integrating Envmap */
		float weight = 0.0;
		vec3 out_radiance = vec3(0.0);

		float lodMax = 5.0;
		float lodFactor = 0.5 * log(float(target_size * target_size) * (1.0/float(sampleCount)) / log(2.0));

		for (int i = 0; i < sampleCount; i++) {

			vec3 L = sample_hemisphere(float(i), N, T, B); /* Microfacet normal */
			float NL = dot(N, L);

			if (NL > 0.0) {
				/* Coarse Approximation of the mapping distortion
				* Unit Sphere -> Cubemap Face */
				const float dist = 4.0 * PI / 6.0;
				float pdf = 0.5 * (1.0 / PI);
				/* http://http.developer.nvidia.com/GPUGems3/gpugems3_ch20.html : Equation 13 */
				float lod = clamp(lodFactor - 0.5 * log2(pdf * dist), 0.0, lodMax);

				out_radiance += textureCubeLodEXT(u_color_texture, L, lod).rgb * NL;
				weight += NL;
			}
		}

		gl_FragColor = vec4(out_radiance / weight, 1.0); //textureCube(u_color_texture, N);
	}

\filter_specular.fs

	#extension GL_EXT_shader_texture_lod : enable
	precision highp float;

	uniform samplerCube u_color_texture;
	uniform sampler2D u_hammersley_sample_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 
	uniform float u_mipCount;
	
	varying vec3 v_dir;
	varying vec2 v_coord;

	#ifdef EM_SIZE
		const int target_size = EM_SIZE;
	#endif

	const float PI = 3.1415926535897932384626433832795;
	const int sampleCount = 256;
	const float HAMMERSLEY_SIZE = 8192.0;
	vec2 jitternoise = vec2(0.0);

	/* -- Tangent Space conversion -- */
	vec3 tangent_to_world(vec3 vector, vec3 N, vec3 T, vec3 B)
	{
	  return T * vector.x + B * vector.y + N * vector.z;
	}
	float noise(vec2 co)  {
		    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}
	vec3 hammersley_3d(float i, float invsamplenbr)
	{
	  vec3 Xi; /* Theta, cos(Phi), sin(Phi) */

	  Xi.x = i * invsamplenbr; /* i/samples */
	  Xi.x = fract(Xi.x + jitternoise.x);

	  int u = int(mod(i + jitternoise.y * HAMMERSLEY_SIZE, HAMMERSLEY_SIZE));

	  Xi.yz = texture2D(u_hammersley_sample_texture, vec2(u, 0)).rg;

	  return Xi;
	}
	vec2 Hammersley(const in int index, const in int numSamples){
		vec2 r = fract(vec2(float(index) * 5.3983, float(int(int(2147483647.0) - index)) * 5.4427));
		r += dot(r.yx, r.xy + vec2(21.5351, 14.3137));
		return fract(vec2(float(index) / float(numSamples), (r.x * r.y) * 95.4337));
	}

	vec3 sample_ggx(vec3 rand, float a2)
	{
	  /* Theta is the aperture angle of the cone */
	  float z = sqrt((1.0 - rand.x) / (1.0 + a2 * rand.x - rand.x)); /* cos theta */
	  float r = sqrt(max(0.0, 1.0 - z * z));                        /* sin theta */
	  float x = r * rand.y;
	  float y = r * rand.z;

	  /* Microfacet Normal */
	  return vec3(x, y, z);
	}

	vec3 sample_ggx(float nsample, float a2, vec3 N, vec3 T, vec3 B)
	{
		vec3 Xi = vec3(
			Hammersley(int(nsample), sampleCount),
			0.0//noise(v_coord)
		);
		// Xi = hammersley_3d(nsample, float(1.0/float(sampleCount)));
		vec3 Ht = sample_ggx(Xi, a2);
		return tangent_to_world(Ht, N, T, B);
	}
	vec3 sample_hemisphere(float nsample, vec3 N, vec3 T, vec3 B)
	{
		vec3 Xi = vec3(
			Hammersley(int(nsample), sampleCount),
			noise(v_coord)
		);
		// Xi = hammersley_3d(nsample, float(1.0/float(sampleCount)));

	  float z = Xi.x;                         /* cos theta */
	  float r = sqrt(max(0.0, 1.0 - z * z)); /* sin theta */
	  float x = r * Xi.y;
	  float y = r * Xi.z;

	  vec3 Ht = vec3(x, y, z);

	  return tangent_to_world(Ht, N, T, B);
	}
	vec3 octahedral_to_cubemap_proj(vec2 co)
	{
	  co = co * 2.0 - 1.0;

	  vec2 abs_co = abs(co);
	  vec3 v = vec3(co, 1.0 - (abs_co.x + abs_co.y));

	  if (abs_co.x + abs_co.y > 1.0) {
	    v.xy = (abs(co.yx) - 1.0) * -sign(co.xy);
	  }

	  return v;
	}

	void make_orthonormal_basis(vec3 N, out vec3 T, out vec3 B)
	{
	  vec3 UpVector = abs(N.z) < 0.99999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
	  T = normalize(cross(UpVector, N));
	  B = cross(N, T);
	}

	vec2 noise2v(vec2 co)  {
	    return vec2(
			fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453),
			fract(sin(dot(co.yx ,vec2(12.9898,78.233))) * 43758.5453)
		);
	}
	
	float D_ggx_opti(float NH, float a2)
	{
	  float tmp = (NH * a2 - NH) * NH + 1.0;
	  return PI * tmp * tmp; /* Doing RCP and mul a2 at the end */
	}

	float pdf_ggx_reflect(float NH, float a2)
	{
	  return NH * a2 / D_ggx_opti(NH, a2);
	}

	float brightness(vec3 c)
	{
	  return max(max(c.r, c.g), c.b);
	}

	void main() {

		const vec2 map_size = vec2(16.0);
		const vec2 texelSize = 1.0 / map_size;
		vec2 uvs = v_coord; //mod(v_coord, map_size) * texelSize;
		const float paddingSize = 1.0;

		/* Add a N pixel border to ensure filtering is correct
		* for N mipmap levels. */
		//uvs = (uvs - texelSize * paddingSize) / (1.0 - 2.0 * texelSize * paddingSize);

		/* edge mirroring : only mirror if directly adjacent
		* (not diagonally adjacent) */
		vec2 m = abs(uvs - 0.5) + 0.5;
		vec2 f = floor(m);
		if (f.x - f.y != 0.0) {
			uvs = 1.0 - uvs;
		}

		/* clamp to [0-1] */
		uvs.x = clamp(uvs.x, 0.0, 1.0);
		uvs.y = clamp(uvs.y, 0.0, 1.0);

		/* get cubemap vector */
		vec3 cubevec = octahedral_to_cubemap_proj(uvs);

		vec3 N, T, B, V;

		vec3 R = normalize(cubevec);
		
		vec3 dir = vec3( uvs - vec2(0.5), 0.5 );
		dir.y = -dir.y;
		R = normalize( u_rotation * dir );


		/* Isotropic assumption */
		N = V = R;

		make_orthonormal_basis(N, T, B); /* Generate tangent space */
		
		// Setup noise (blender version)
		jitternoise = noise2v(v_coord);

		/* Integrating Envmap */
		float weight = 0.0;
		vec3 out_radiance = vec3(0.0);

		float lodMax = 3.0;
		float lodFactor = 0.5 * log(float(target_size * target_size) * (1.0/float(sampleCount)) / log(2.0));
		float roughnessSquared = u_roughness * u_roughness;

		for (int i = 0; i < sampleCount; i++) {

			vec3 H = sample_hemisphere(float(i), N, T, B); /* Microfacet normal */
			vec3 L = -reflect(V, H);
			float NL = dot(N, L);

			if (NL > 0.0) {
			      float NH = max(1e-8, dot(N, H)); /* cosTheta */

			      /* Coarse Approximation of the mapping distortion
			       * Unit Sphere -> Cubemap Face */
			      const float dist = 4.0 * PI / 6.0;
			      float pdf = pdf_ggx_reflect(NH, roughnessSquared);
			      /* http://http.developer.nvidia.com/GPUGems3/gpugems3_ch20.html : Equation 13 */
			      float lod = 0.0;//clamp(lodFactor - 0.5 * log2(pdf * dist), 0.0, lodMax);

			      vec3 l_col = textureCubeLodEXT(u_color_texture, L, lod).rgb;

			      /* Clamped brightness. */
			      float luma = max(1e-8, brightness(l_col));
			      l_col *= 1.0 - max(0.0, luma - 2.0) / luma;

			      out_radiance += l_col * NL;
			      weight += NL;
			    }
		}

		gl_FragColor = vec4(out_radiance / weight, 1.0); // textureCube(u_color_texture, R);
	}

//
// Deferred shading
//

\DeferredCubemap.fs

	// save information in pre-pass (up to 4 buffers)
	#extension GL_EXT_draw_buffers : require
	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec3 u_camera_position;
	uniform vec4 u_color;
	uniform float u_roughness;
	uniform float u_metalness;
	uniform samplerCube u_color_texture;

	void main() {
		vec3 V = normalize(u_camera_position - v_wPosition);
		vec3 N = normalize(v_wNormal);
		vec4 diffuse_color = textureCube(u_color_texture, V);

		// fill last color component with the metalness to avoid using another buffer
		gl_FragData[0] = diffuse_color;
		// fill last normals component with the roughness to avoid using another buffer
		gl_FragData[1] = vec4((N * 0.5 + vec3(0.5) ), 1.0); 
		gl_FragData[2] = vec4(vec3(u_roughness), 1.0);
		// gl_FragData[3] = ...
	}

\ssao.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
	uniform vec4 u_viewport;

	uniform mat4 u_invp;
	uniform mat4 u_invv;
	uniform mat4 u_invvp;
	uniform mat4 u_projection;
	uniform mat4 u_view;

	uniform float u_near;
	uniform float u_far;

	uniform sampler2D u_color_texture;
	uniform sampler2D u_position_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_depth_texture;
	uniform sampler2D u_noise_texture;

	uniform bool u_downsampled;

	#ifdef INPUT_TEX_WIDTH
		float width = float(INPUT_TEX_WIDTH);
	#endif
	#ifdef INPUT_TEX_HEIGHT
		float height = float(INPUT_TEX_HEIGHT);
	#endif

	uniform vec3 u_samples[64];
	uniform float u_radius;
	uniform float u_bias;

	uniform float u_max_dist;
	uniform float u_min_dist;

	varying vec2 v_coord;

	#import "matrixOp.inc"

	vec3 getPositionWSFromDepth(float depth)
	{
		//build pixel info
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
		
		/*
		*	GET INFO
		*/
		
		// Texture Maps
		vec4 colorMap = texture2D( u_color_texture, v_coord );
		vec4 depthMap = texture2D( u_depth_texture, v_coord);
		vec4 normalMap = texture2D( u_normal_texture, v_coord);
		vec3 normal    = normalize(normalMap.xyz * 2. - 1.);
		vec4 positionMap = texture2D( u_position_texture, v_coord);
		
		// Properties and depth
		float depth = readDepth(u_depth_texture, v_coord);

		// Random vector per fragment
		if(u_downsampled)
		{
			width /= 4.0;
			height /= 4.0;
		}

		vec2 noiseScale = vec2(width/4.0, height/4.0); 
		vec3 randomVec = texture2D(u_noise_texture, v_coord * noiseScale).xyz * 2.0 - vec3(1.0);

		// Vectors
		vec3 position = positionMap.xyz; //getPositionWSFromDepth(depth);
		
		/*
		*	SSAO
		*/

		vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
		vec3 bitangent = cross(normal, tangent);
		mat3 TBN       = mat3(tangent, bitangent, normal);  

		float radius = u_radius;
		float bias = u_bias;
		float occlusion = 0.0;

		for(int i = 0; i < 64; ++i)
		{
			// get sample position
			vec3 sample = TBN * u_samples[i]; // From tangent to view-space
			sample = position + sample * radius;
			
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

		occlusion = 1.0 - (occlusion / 64.0);
		gl_FragColor = vec4(vec3(occlusion), 1.0);
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

\ggx.inc

	const float M_PI = 3.141592653589793;

	// Geometry Term : Geometry masking / shadowing due to microfacets
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float roughness, float NdotV, float NdotL){
		float k = (roughness )*(roughness ) / 2.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}

	// This calculates the specular geometric attenuation (aka G()),
	// where rougher material will reflect less light back to the viewer.
	// This implementation is based on [1] Equation 4, and we adopt their modifications to
	// linearRoughness as input as originally proposed in [2].
	float geometricOcclusion(PBRInfo pbrInputs)
	{
		float NdotL = pbrInputs.NdotL;
		float NdotV = pbrInputs.NdotV;
		float r = pbrInputs.linearRoughness;

		float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
		float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
		return attenuationL * attenuationV;
	}

	// Schlick-GGX approximation of geometric attenuation function using Smith's method.
	float gaSchlickGGX(float cosLi, float cosLo, float roughness)
	{
		float r = roughness + 1.0;
		float k = (r * r) / 8.0; // Epic suggests using this roughness remapping for analytic lights.
		return GGX(cosLi, k) * GGX(cosLo, k);
	}

	// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
	// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
	// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
	float microfacetDistribution(PBRInfo pbrInputs)
	{
		float roughnessSq = pbrInputs.linearRoughness * pbrInputs.linearRoughness;
		float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
		return roughnessSq / (M_PI * f * f);
	}

	// GGX/Towbridge-Reitz normal distribution function.
	// Uses Disney's reparametrization of alpha = roughness^2.
	float ndfGGX(float alpha, float NdotLh)
	{
		float PI = 3.1415926535897932384626433832795;
		float alpha2 = alpha * alpha;
		float den = NdotLh * NdotLh * (alpha2 - 1.0) + 1.0;
		return alpha2 / (PI * den * den);
	}

	// Basic Lambertian diffuse
	// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
	// See also [1], Equation 1
	vec3 diffuse(PBRInfo pbrInputs)
	{
		return pbrInputs.diffuseColor / M_PI;
	}

	vec3 specularReflection(PBRInfo pbrInputs)
	{
		return pbrInputs.reflectance0 + 
				(pbrInputs.reflectance90 - pbrInputs.reflectance0) * 
				pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
	}

\bump.inc
	//Javi Agenjo Snipet for Bump Mapping
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

	vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
		#ifdef USE_POINTS
		return N;
		#endif

		// assume N, the interpolated vertex normal and
		// V, the view vector (vertex to eye)
		//vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
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

\testpbr.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;
	attribute vec4 a_bone_indices;
	attribute vec4 a_weights;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	varying vec3 v_vPosition;
	varying vec3 v_vNormal;	

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;
	uniform mat4 u_bones[64];
	uniform bool u_Skinning;

	uniform float u_bumpScale;
	uniform sampler2D u_height_texture;
	uniform mat4 u_mvp;
	uniform mat4 u_viewprojection;
	uniform mat4 u_model;
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

		// view space vectors for screen space
		mat4 mv = u_view * u_model;
		v_vPosition = (mv * vec4(a_vertex,1.0)).xyz;
		v_vNormal = normalize((mv * vec4(a_normal,0.0)).xyz);
		// ***********

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

\testpbr.fs

	#extension GL_OES_standard_derivatives : enable
	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_EXT_draw_buffers : require
	precision highp float;

	#define GAMMA 2.2
	#define PI 3.14159265359
	#define RECIPROCAL_PI 0.3183098861837697
	#define MAX_REFLECTANCE 0.16
	#define MIN_REFLECTANCE 0.04
	#define MIN_PERCEPTUAL_ROUGHNESS 0.045
	#define MIN_ROUGHNESS            0.002025
	#define MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS 0.6

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec3 v_vPosition;
	varying vec3 v_vNormal;	
	varying vec2 v_coord;

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
	uniform bool u_show_layers;
	uniform bool u_applyGamma;

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
	uniform vec3 u_reflectance;
	uniform float u_clearCoat;
	uniform float u_clearCoatRoughness;

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

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;

	// GUI
	uniform bool u_flipX;
	uniform bool u_renderDiffuse;
	uniform bool u_renderSpecular;
	uniform float u_ibl_intensity;
	uniform bool u_enable_ao;
	uniform bool u_gamma_albedo;
	
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
	};

	//Javi Agenjo Snipet for Bump Mapping
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

	vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
		#ifdef USE_POINTS
		return N;
		#endif

		// assume N, the interpolated vertex normal and
		// V, the view vector (vertex to eye)
		//vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
		normal_pixel = normal_pixel * 255./127. - 128./127.;
		mat3 TBN = cotangent_frame(N, V, texcoord);
		return normalize(TBN * normal_pixel);
	}

	#define MEDIUMP_FLT_MAX    65504.0
	#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)

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

		return vec3( clamp(iorToF0(  f0ToIor(f0.x), ior ), 0.0, 1.0) );
	}

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

	void updateVectors (inout PBRMat material) {

		vec3 v = normalize(u_camera_position - v_wPosition);
		vec3 n = normalize( v_wNormal );

		if(u_properties_array0.w != 0.){
			vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
			vec3 n2 = normalize( perturbNormal( n, -v, v_coord, normal_map ) );
			n = normalize(mix(n, n2, u_normalFactor));
		}

		// OMNI
		vec3 l = normalize(u_light_position - v_wPosition);
		material.light.fallOf = 1.0;
		
		#if LIGHT_TYPE == 2 // SPOT
			material.light.fallOf = spotFalloff(normalize(u_light_direction), l, u_light_angle.x, u_light_angle.y);
		#elif LIGHT_TYPE == 3 // DIRECTIONAL
			l = normalize(u_light_direction);
		#endif

		vec3 h = normalize(v + l);

		material.light.direction = l;
		material.reflection = normalize(reflect(v, n));

		if(u_flipX)
			material.reflection.x = -material.reflection.x;
		material.N = n;
		material.V = v;
		material.H = h;
		material.H = h;
		material.NoV = clamp(dot(n, v), 0.0, 0.99) + 1e-6;
		material.NoL = clamp(dot(n, l), 0.0, 1.0) + 1e-6;
		material.NoH = clamp(dot(n, h), 0.0, 1.0) + 1e-6;
		material.LoH = clamp(dot(l, h), 0.0, 1.0) + 1e-6;
		material.VoH = clamp(dot(v, h), 0.0, 1.0) + 1e-6;
	}

	vec3 computeDiffuseColor(vec3 baseColor, float metallic) {
	
		return (1.0 - metallic) * baseColor;
	}

	vec3 computeF0(const vec3 baseColor, float metallic, vec3 reflectance) {
	    return baseColor * metallic + (reflectance * (1.0 - metallic));
	}

	float rand(vec2 co)  {
		return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
	}

	void createMaterial (inout PBRMat material) {
		
		float metallic = max(0.01, u_metalness);
		
		if(u_properties_array0.z != 0.)
			metallic *= texture2D(u_metalness_texture, v_coord).r;

		vec3 baseColor = u_albedo;
		if(u_properties_array0.x != 0.){
			vec3 albedo_tex = texture2D(u_albedo_texture, v_coord).rgb;
			albedo_tex = pow(albedo_tex, vec3(GAMMA));
			baseColor *= albedo_tex;
		}

		// GET COMMON MATERIAL PARAMS
		vec3 reflectance = computeDielectricF0(u_reflectance);
		vec3 diffuseColor = computeDiffuseColor(baseColor, metallic);
		vec3 f0 = computeF0(baseColor, metallic, reflectance);

		// GET COAT PARAMS
		float clearCoat = u_clearCoat; // clear coat strengh
		float clearCoatRoughness = u_clearCoatRoughness;

		clearCoatRoughness = mix(MIN_PERCEPTUAL_ROUGHNESS, MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS, clearCoatRoughness);
		float clearCoatLinearRoughness = sq(clearCoatRoughness);

		// recompute f0 by computing its IOR
		f0 = mix(f0, f0ClearCoatToSurface(f0, 1.5), clearCoat);

		// GET ROUGHNESS PARAMS
		float roughness = 1.0;
		if(u_properties_array0.y != 0.){
				
			vec4 sampler = texture2D(u_roughness_texture, v_coord);

			if(u_metallicRough) {
				roughness *= sampler.g; // roughness stored in g
				metallic = max(0.01, u_metalness) * sampler.b; // recompute metallness using metallic-rough texture
				diffuseColor = computeDiffuseColor(baseColor, metallic); // recompute diffuse color
			}
			else
				roughness *= sampler.r;
		}

		roughness *= u_roughness;

		if(false)
			roughness = rand(v_wPosition.xz);

		roughness = clamp(roughness, MIN_ROUGHNESS, 1.0);	
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
		
		updateVectors( material );
	}

	vec3 specularBRDF( const in PBRMat material ) {

		// Normal Distribution Function
		float D = D_GGX( material.NoH, material.linearRoughness );
		// D = D_GGX_2(material.linearRoughness, material.NoH, material.N, material.H);

		// Visibility Function (shadowing/masking)
		float V = G_Smith( material.NoV, material.NoL, material.roughness );
		// V = Geometric_Smith_Schlick_GGX_(material.linearRoughness, material.NoV, material.NoL);
		
		// Fresnel
		vec3 F = F_Schlick( material.LoH, material.f0 );

		vec3 spec = (D * V) * F;
		spec /= (4.0 * material.NoL * material.NoV + 1e-6);

		return spec;
	}

	float specularClearCoat( const PBRMat material, inout float Fc) {

		float D = D_GGX( material.clearCoatLinearRoughness, material.NoH );
		float V = V_Kelemen( material.LoH );
		Fc = F_Schlick( material.LoH, 0.04, 1.0 ) * material.clearCoat; // 0.04 is the f0 for IOR = 1.5

		return (D * V) * Fc;
	}

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

	vec3 prem(vec3 R, float roughness, float rotation) {

		float 	f = roughness * u_mipCount;
		vec3 	r = (rotationMatrix(vec3(0.0,1.0,0.0),rotation) * vec4(R,1.0)).xyz;

		vec4 color;

		if(f < 1.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 0.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 1.0), f );
		else if(f < 2.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 1.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 2.0), f - 1.0 );
		else if(f < 3.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 2.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 3.0), f - 2.0 );
		else if(f < 4.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 3.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 4.0), f - 3.0 );
		else if(f < 5.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 4.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 5.0), f - 4.0 );
		else color = textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 5.0);

		/*else if(f < 6.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 5.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 6.0), f - 5.0 );
		else if(f < 7.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 6.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 7.0), f - 6.0 );
		else if(f < 8.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 7.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 8.0), f - 7.0 );
		else color = textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 8.0);*/

		return color.rgb;
	}

	// Fdez-Agüera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
	// Approximates multiscattering in order to preserve energy.
	// http://www.jcgt.org/published/0008/01/03/
	void ibl_multiscattering (PBRMat material, inout vec3 Fd, inout vec3 Fr) {
		
		// Roughness dependent fresnel
		vec3 Fresnel = max(vec3(1.0 - material.roughness), material.f0) - material.f0;
		vec3 kS = material.f0 + Fresnel * pow(1.0 - material.NoV, 5.0);
		vec3 F = F_Schlick( material.NoV, material.f0 );
		vec2 f_ab = texture2D( u_brdf_texture, vec2(material.NoV, material.roughness) ).rg;
		vec3 FssEss = kS * f_ab.x + f_ab.y;

		// Prefiltered radiance
		vec3 radiance = prem(material.reflection, material.roughness, u_rotation);
		// Cosine-weighted irradiance
		vec3 irradiance = prem(material.reflection, 1.0, u_rotation);

		// Conductors
		float Ess = f_ab.x + f_ab.y;
		float Ems = 1.0 - Ess;
		vec3 Favg = material.f0 + (1.0 - material.f0) * RECIPROCAL_PI;
		vec3 Fms = FssEss * Favg / (1.0 - Ems * Favg);
		
		// Dielectrics
		vec3 Edss = 1.0 - (FssEss + Fms * Ems);
		vec3 kD =  pow(material.baseColor, vec3(1.0/GAMMA)) * Edss;

		// Composition
		if(u_renderDiffuse)
			Fd += (Fms*Ems+kD) * irradiance;
		if(u_renderSpecular)
			Fr += FssEss * radiance;
	}

	void getIBLContribution (PBRMat material, inout vec3 Fd, inout vec3 Fr)
	{
		float NdotV = material.NoV;

		vec2 brdfSamplePoint = vec2(NdotV, material.roughness);
		vec2 brdf = texture2D(u_brdf_texture, brdfSamplePoint).rg;

		vec3 normal = -material.N;
		if(u_flipX)
			normal.x *= -1.;

		vec3 diffuseSample = prem(normal, 1.0, u_rotation); // diffuse part uses normal vector (no reflection)
		vec3 specularSample = prem(material.reflection, material.roughness, u_rotation);

		vec3 specularColor = mix(material.f0, material.baseColor.rgb, material.metallic);

		if(u_renderDiffuse)
			Fd += diffuseSample * material.diffuseColor;
		if(u_renderSpecular)
			Fr += specularSample * (specularColor * brdf.x + brdf.y);
	}

	void do_lighting(inout PBRMat material, inout vec3 color)
	{
		// INDIRECT LIGHT: IBL ********************

		vec3 Fd_i = vec3(0.0);
		vec3 Fr_i = vec3(0.0);
		//ibl_multiscattering(material, Fd_i, Fr_i); // needs some work
		getIBLContribution(material, Fd_i, Fr_i); // no energy conservation
		
		// CLEAT COAT LOBE ************************

		float Fcc = F_Schlick(material.NoV, 0.04) * material.clearCoat;

		// coatBump can change this
		vec3 R = material.reflection;

		if(u_properties_array1.w != 0.) {
			vec3 coat_bump = texture2D( u_height_texture, v_coord ).xyz;
			coat_bump = normalize( perturbNormal( material.reflection, -material.V, v_coord, coat_bump ) );
			R = coat_bump;
		}

		// apply clear coat
		vec3 indirect = Fr_i + Fd_i;
		indirect += prem(R, material.clearCoatRoughness, u_rotation) * Fcc;
		// apply tint
		indirect *= mix(vec3(1.0), u_tintColor, material.clearCoat * 0.9);

		// Apply ambient oclusion 
		if(u_properties_array1.z != 0. && u_enable_ao)
			indirect *= texture2D(u_ao_texture, v_coord).r;
		
		// DIRECT LIGHT ***************************

		vec3 Fr_d = specularBRDF( material );
		vec3 Fd_d = material.diffuseColor * Fd_Burley (material.NoV, material.NoL, material.LoH, material.linearRoughness);
		vec3 direct = Fr_d + Fd_d;

		// COMPOSE
		vec3 lightParams = material.NoL * u_light_color * u_light_intensity * material.light.fallOf;
		color  =   indirect * u_ibl_intensity;
		color +=  direct * lightParams;
	}

	void main() {
        
		float alpha = u_alpha;

		if(u_properties_array1.y != 0.)
			alpha *= texture2D(u_opacity_texture, v_coord).r;
		else
			alpha *= texture2D( u_albedo_texture, v_coord ).a;

		if(alpha < u_alpha_cutoff)
		discard;

		PBRMat material;
		vec3 color;

		createMaterial( material );
		do_lighting( material, color);

		if(u_properties_array1.x != 0.)
			color += texture2D(u_emissive_texture, v_coord).rgb * u_emissiveScale;
		
		gl_FragData[0] = vec4(color, alpha);
		// set vectors in view space
		gl_FragData[1] = vec4( v_vNormal * 0.5 + vec3(0.5), 1.0); 
		gl_FragData[2] = vec4( v_vPosition, 1.0);
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

	uniform float u_chroma_ibl_intensity;
	uniform float u_light_intensity;
	uniform vec3 u_light_color;
	uniform vec3 u_light_position;

	uniform samplerCube u_SpecularEnvSampler_texture;
	uniform samplerCube u_Mip_EnvSampler1_texture;
	uniform samplerCube u_Mip_EnvSampler2_texture;
	uniform samplerCube u_Mip_EnvSampler3_texture;
	uniform samplerCube u_Mip_EnvSampler4_texture;
	uniform samplerCube u_Mip_EnvSampler5_texture;

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

	//Javi Agenjo Snipet for Bump Mapping
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

	vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
		#ifdef USE_POINTS
		return N;
		#endif

		// assume N, the interpolated vertex normal and
		// V, the view vector (vertex to eye)
		//vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
		normal_pixel = normal_pixel * 255./127. - 128./127.;
		mat3 TBN = cotangent_frame(N, V, texcoord);
		return normalize(TBN * normal_pixel);
	}

	vec3 V, R, L, N, pN;

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

		vec3 IndirectDiffuse = textureCube(u_Mip_EnvSampler5_texture, -pN).rgb;// * max(0.,dot(-R, N));

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

	vec3 ComputeSHIrradiance(in vec3 normal, in SH9Color radiance)
	{
		if(u_flipX)
			normal.x = -normal.x;

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
		
		return irradiance;
	}

	vec3 ComputeSHDiffuse(in vec3 normal, in SH9Color radiance)
	{
		// Diffuse BRDF is albedo / Pi
		return ComputeSHIrradiance( normal, radiance ) * (1.0 / Pi);
	}

	void main()
	{
		vec3 normal = normalize( v_normal );
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

		vec3 irradiance = ComputeSHDiffuse( -normal, coeffs );

		gl_FragData[0] =  vec4(max( vec3(0.001), irradiance ), 1.0 );
	}
	
\matrixOp.inc

	vec3 world2view( vec3 a ){ return  (u_view * vec4(a,1.0)).xyz; }
	vec3 view2world( vec3 a ){ return (u_invv * vec4(a,1.0)).xyz; }
	vec3 view2screen( vec3 a){ return  (u_projection * vec4(a,1.0)).xyz; }
	vec3 screen2view( vec3 a){ return (u_invp * vec4(a,1.0)).xyz; }
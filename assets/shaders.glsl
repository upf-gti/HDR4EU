\shaders

// Basic shaders
flat default.vs default.fs
textured default.vs tex.fs
flipY screen_shader.vs flipY.fs
grid default.vs grid.fs

testTonemapHDRIntermediate screen_shader.vs testTonemapHDRIntermediate.fs
HDRassembly screen_shader.vs HDRassembly.fs
combineHDR screen_shader.vs combineHDR.fs
assemblyViewer screen_shader.vs assemblyViewer.fs
assemblyQuadViewer assemblyQuadViewer.vs assemblyQuadViewer.fs

// Cubemap shaders
skybox default.vs skybox.fs
sphereMap default.vs sphereMap.fs
atmos default.vs atmos.fs

// Cubemap FX Shaders
blur blur.vs blur.fs
defblur defblur.vs defblur.fs
mirror default.vs mirroredSphere.fs
diffCubemap screen_shader.vs diffCubemap.fs

// Texture FX Shaders

glow screen_shader.vs glow.fs
maxLum screen_shader.vs maxLum.fs
luminance screen_shader.vs luminance.fs

// Deferred rendering Shaders
ssao screen_shader.vs ssao.fs
finalDeferred screen_shader.vs finalDeferred.fs
DeferredCubemap default.vs DeferredCubemap.fs
linearDepth screen_shader.vs linearDepth.fs

// PBR
pbr testpbr.vs testpbr.fs

//
// Default vertex shader 
//

\HDRassembly.fs

	precision highp float;
	varying vec2 v_coord;
	uniform int u_numImages;
	// uniform sampler2D u_stack[4]; // not supported yet
	uniform sampler2D u_stack0;
	uniform sampler2D u_stack1;
	uniform sampler2D u_stack2;
	uniform sampler2D u_stack3;
	uniform sampler2D u_stack4;
	uniform sampler2D u_stack5;
	//	uniform sampler2D u_stack6;
	//	uniform sampler2D u_stack7;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}


	float weight( float value ){
		
		if(value <= 0.5)
			return value;
		else
			return (1.0 - value);
	}

	float Tweight( float value ){
		
		if(value < 0.02 || value > 0.98)
			return value;
		else
			return 1.0;
	}

	void main() {

		int refId = int(float(u_numImages) / 2.0);

		float weightSum = 0.0;
		vec4 hdr = vec4(0.0);

		vec3 samplers[16]; 
		samplers[0] = texture2D( u_stack0, v_coord ).rgb;
		samplers[1] = texture2D( u_stack1, v_coord ).rgb;
		samplers[2] = texture2D( u_stack2, v_coord ).rgb;
		samplers[3] = texture2D( u_stack3, v_coord ).rgb;
		samplers[4] = texture2D( u_stack4, v_coord ).rgb;
		samplers[5] = texture2D( u_stack5, v_coord ).rgb;
		//samplers[6] = texture2D( u_stack6, v_coord ).rgb;
		//samplers[7] = texture2D( u_stack7, v_coord ).rgb;

		for( int i = 0; i < 16; i++ )
		{
			if( i < u_numImages )
			{
				/*vec3 ldr = samplers[i];
				float lum = luminance( ldr );
				float w = weight( lum ) + 1e-6;
				float exposure = pow(2.0, float(i - refId));
				
				hdr.rgb += (ldr*exposure) * w;
				weightSum += w;*/

				vec3 ldr = samplers[i];
				ldr = pow(ldr, vec3(1.0/2.2));
				float lum = luminance( ldr );
				float w = weight( lum ) + 1e-6;
				
				hdr.rgb += (ldr) * w;
				weightSum += w;
			}
		}

		hdr.rgb /= (weightSum + 1e-6);
		hdr.a = log(luminance(hdr.rgb) + 1e-6);

		gl_FragColor = hdr;
	}

\testTonemapHDRIntermediate.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform sampler2D u_texture;

	void main() {

		vec4 color = texture2D(u_texture, v_coord);
		// color /= (vec4(color) + vec4(1.0));
		//color *= 0.02;
		gl_FragColor = color;
	}

\default.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform mat4 u_mvp;
	uniform mat4 u_model;
	void main() {
		v_wPosition = (u_model * vec4(a_vertex, 1.0)).xyz;
		v_wNormal = (u_model * vec4(a_normal, 0.0)).xyz;
		v_coord = a_coord;
		gl_Position = u_mvp * vec4(a_vertex, 1.0);
	}

//
// Default fragment shader 
//

\default.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	void main() {

		gl_FragColor = u_color;
	}

\tex.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	uniform sampler2D u_albedo_texture;

	void main() {

		gl_FragColor = texture2D(u_albedo_texture, v_coord);
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

\assemblyQuadViewer.vs

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

\assemblyQuadViewer.fs

	precision highp float;
	uniform sampler2D u_texture;
	uniform sampler2D u_texture_mip;
	uniform vec4 u_color;
	varying vec2 v_coord;

	uniform float Brightness;
	uniform bool u_is_cropped;
	
	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}
	
	void main() {

		vec3 hdr = texture2D(u_texture, v_coord).rgb;
		float logAvgLum = exp( texture2D(u_texture_mip, v_coord, 20.0).a );

		float lum = luminance(hdr);
		float lum_TM = 1.0 - exp( -Brightness * lum/logAvgLum );

		if(u_is_cropped)
			hdr.rgb *= lum_TM/lum;

		vec4 color = vec4(hdr, 1.0);

		gl_FragColor = u_color * color;
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
	uniform float u_mipmap_offset;
	varying vec2 v_coord;
	
	void main() {
		
		int k = 0;
		const float delta = 0.000001;
		float sumLog = 0.0;
		float sum = 0.0;
		
		const float width = float(16);
		const float height = float(16);
		
		for(float i = 0.5; i < width; i++)
		for(float j = 0.5; j < height; j++)
		{
			vec2 coord = vec2(i, j) / vec2(width, height);
			vec4 pixelColor = texture2D(u_texture, coord);
			
			float lum = 0.2126 * pixelColor.r + 0.7152 * pixelColor.g + 0.0722 * pixelColor.b;
			float logLum = log( lum + delta );
			
			sumLog += logLum;
			sum += lum;
			k++;
		}

		float averageLogLum = sumLog / float(k);
		float averageLum = sum / float(k);
		gl_FragColor = vec4(averageLum, averageLogLum, 0.0, 1.0);
	}

//
// Reflect environment to an sphere (+ Exposure)
//

\mirroredSphere.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	uniform vec4 u_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture;

	void main() {

		vec3 E = v_wPosition - u_camera_position;
		E = normalize(E);

		// r = 2n(n · v) − v
		vec3 n = normalize(v_wNormal);

		vec3 w0 = E;
		vec3 wr = 2.0 * dot(n, w0) * n;
		wr -= w0;
		wr = normalize(wr);

		vec4 color = textureCube(u_color_texture, wr);
		
		color = pow(color, vec4(1.0/2.2));

		gl_FragColor = u_color * color;
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

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_rotation;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform bool u_applyGamma;

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

		vec4 color = textureCube(u_color_texture, E);

		if(u_is_rgbe)
			color = vec4(color.rgb * pow(2.0, color.a * 255.0 - 128.0), 1.0);
		
		if(u_applyGamma)
			color = pow(color, vec4(1.0/2.2));

		gl_FragColor = color;
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

	precision highp float;

	uniform samplerCube u_color_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 

	varying vec3 v_dir;
	varying vec2 v_coord;

	const float PI = 3.1415926535897932384626433832795;

	#ifdef EM_SIZE
		const float size = float(EM_SIZE);
	#endif

	#import "brdf.inc"

	void main() {

		vec3 N = normalize( u_rotation * v_dir );

		vec4 color = vec4(0.0);
		float TotalWeight = 0.0;
		float samples = 0.0;
		float roughness = min(0.96, u_roughness);
		float alphaRoughness = roughness * roughness;

		// (gl_FragCoord.xy) / vec2(size, size) = v_coord
		const float step = size > 256.0 ? 2.0 : 1.0;
	
		for(float i = 0.5; i < size; i+=step)
		for(float j = 0.5; j < size; j+=step) {

			// Get pixel
			vec2 r_coord = vec2(i, j) / vec2(size, size);
			// Get 3d vector
			vec3 dir = vec3( r_coord - vec2(0.5), 0.5 );
			dir.y *= -1.0;

			// Use all faces
			for(int f = 0; f < 6; f++) {

				mat3 _camera_rotation = u_cameras[f];
				vec3 NF = normalize( _camera_rotation * dir );

				float weight = max(0.0, dot(N, NF));
				float pow_weight = pow(weight, 32.0 * (1.0 - roughness ));

				if(weight > 0.0 ) {
					color += textureCube(u_color_texture, NF) * pow_weight;
					TotalWeight += pow_weight;
					samples ++;
				}
				
			}
		}

		gl_FragColor = color / TotalWeight;
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
	uniform vec3 u_camera_position;
	uniform vec3 u_light_position;
	uniform float u_light_intensity;
	uniform vec4 u_viewport;
	uniform mat4 u_invp;
	uniform mat4 u_projection;
	uniform mat4 u_invv;
	uniform mat4 u_view;

	uniform float u_near;
	uniform float u_far;

	uniform vec2 u_noiseScale;
	uniform vec2 u_kernel[12];
	uniform float u_radius;
	uniform float u_z_discard;
	uniform float u_normal_z;


	uniform float u_noise_tiling;

	uniform sampler2D u_fbo_normal_texture;
	uniform sampler2D u_fbo_depth_texture;
	uniform sampler2D u_noise_texture;

	varying vec2 v_coord;

	vec3 getWorldPosition(float depth) {

		float z = depth * 2.0 - 1.0;

		vec4 clipSpacePosition = vec4(v_coord * 2.0 - 1.0, z, 1.0);
		vec4 worldSpacePosition = u_invp * clipSpacePosition;
		return worldSpacePosition.xyz;
	}

	vec3 getViewPosition(float depth) {

		float z = depth * 2.0 - 1.0;

		vec4 clipSpacePosition = vec4(v_coord * 2.0 - 1.0, z, 1.0);
		vec4 worldSpacePosition = u_invp * clipSpacePosition;

		// To view space
		vec4 viewSpacePosition = worldSpacePosition;
		viewSpacePosition /= viewSpacePosition.w;

		return viewSpacePosition.xyz;
	}

	float perspectiveDepthToViewZ( float invClipZ, float near, float far ) {
	
		return ( near * far ) / ( ( far - near ) * invClipZ - far );
	}

	float viewZToOrthographicDepth( float viewZ, float near, float far ) {
		return ( viewZ + near ) / ( near - far );
		
	}

	float readDepth( vec2 coord, float n, float f) {
		
		float z = texture2D(u_fbo_depth_texture, coord).r * 2.0 - 1.0;

		float EZ  = (2.0 * n * f) / (f + n - z * (f - n));
		float LZ  = (EZ - n) / (f - n);
		float LZ2 = EZ / f;

		return z;
	}

	/*float getLinearDepth( vec2 screenPosition ) {

		float fragCoordZ = texture2D( u_fbo_depth_texture, screenPosition ).x;
		float viewZ = perspectiveDepthToViewZ( fragCoordZ, u_near, u_far );
		return viewZToOrthographicDepth( viewZ, u_near, u_far );
	}*/

	vec2 getScreenCoord(vec3 hitCoord) {

		vec4 projectedCoord = u_projection * vec4(hitCoord, 1.0);
		projectedCoord /= projectedCoord.w;
		return projectedCoord.xy * 0.5 + 0.5;
	}

	float roundEven( float x ) {
	
		float f = floor(x);
		return (mod(f, 2.0) == 0.0) ? f : floor(x+1.0);
	}

	float getLinearDepth( float z, float n, float f) {
		
		float EZ  = (2.0 * n * f) / (f + n - z * (f - n));
		float LZ  = (EZ - n) / (f - n);

		return LZ;
	}

	float rand(vec2 co)  {
	    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
	}

	void main() {
		
		float depth = texture2D(u_fbo_depth_texture, v_coord).r;
		depth = getLinearDepth(depth, u_near, u_far);

		vec3 viewPosition = getViewPosition(depth);
		vec3 worldPos = getWorldPosition(depth);

		vec3 viewNormal = normalize( texture2D(u_fbo_normal_texture, v_coord).xyz * 2.0 - 1.0 );
		viewNormal = ( vec4(viewNormal, 0.0) * u_invv ).xyz;

		/*const vec2 resolution = vec2(INPUT_TEX_WIDTH, INPUT_TEX_HEIGHT);
		vec2 noiseScale = vec2(float(resolution.x) / u_noise_tiling, float(resolution.y) / u_noise_tiling);
		float aspect = roundEven( float(resolution.x) / float(resolution.y) );
		vec2 coords = vec2(v_coord.x * aspect * 150.0, v_coord.y * 150.0);
		vec3 rvec = normalize(texture2D(u_noise_texture, coords).xyz);
		rvec = normalize( vec3( rand(v_coord.xy), rand(v_coord.yx), 1.0 ) );*/
		
		// Find a random rotation angle based on the world coords
		float rand_val = rand(worldPos.xy);
		float angle = 2.0 * 3.14159268 * (rand_val);
		float cos_angle = cos( angle );
		float sin_angle = sin( angle );

		vec3 rvec = vec3(rand_val);

		vec3 tangent = rvec - viewNormal * dot(rvec, viewNormal);
		normalize(tangent);
		vec3 bitangent = cross(viewNormal, tangent);
		mat3 tbn = mat3(tangent, bitangent, viewNormal);

		float occlusion = 0.0;

		float amount_normal_z = u_normal_z;
		float amount_displaced = u_radius / u_far;
		float zrange_discard = u_z_discard;

		for (int i = 0; i < 12; i++) {
			
			vec2 coords = u_kernel[i];
			 vec2 rotated_coord = vec2( 
                              coords.x * cos_angle - coords.y * sin_angle,
                              coords.y * cos_angle + coords.x * sin_angle 
                              );

			// get sample position and reorient in view space
			vec3 sample = vec3(rotated_coord, amount_normal_z) * tbn;
			vec3 samplePoint = viewPosition + (sample * amount_displaced);
			float sampleDepth = -samplePoint.z;
		  
			// project sample position:
			vec2 projected = getScreenCoord(samplePoint);
			float _depth = texture2D( u_fbo_depth_texture, projected).r;
			/*_depth = perspectiveDepthToViewZ(_depth, u_near, u_far);
			_depth = viewZToOrthographicDepth( _depth , u_near, u_far );*/
			_depth = getLinearDepth( _depth, u_near, u_far);

			// This is to prevent large Z range to generate occlusion... will remove black halos in the character head
			// v1
			/*float rangeCheck= abs(depth - _depth) < amount_displaced ? 1.0 : 0.0;
			occlusion += (_depth <= sampleDepth ? 1.0 : 0.0) * rangeCheck;*/

			// v2
			float rangeCheck = smoothstep( 0.0, zrange_discard, abs(depth - _depth) );
			occlusion += ( _depth <= sampleDepth ? 1.0 : 0.0) * rangeCheck;
			
			// v3
			/*float delta = viewZToOrthographicDepth( sampleDepth , u_near, u_far ) - _depth;

			if ( delta > 0.005 && delta < 0.1 ) {

				occlusion += 1.0;

			}*/
		}

		occlusion =  1.0 - clamp( occlusion / 12.0, 0.0, 1.0);
		gl_FragColor = vec4(vec3(occlusion), 1.0);
	}

\finalDeferred.fs

	#extension GL_EXT_shader_texture_lod : enable
	#extension GL_OES_standard_derivatives : enable

	precision highp float;
	uniform vec3 u_camera_position;
	uniform vec3 u_light_position;
	uniform float u_light_intensity;
	uniform vec4 u_viewport;
	uniform mat4 u_invp;
	uniform mat4 u_projection;
	uniform mat4 u_invv;
	uniform mat4 u_view;

	uniform float u_near;
	uniform float u_far;

	uniform bool u_enableSSAO;
	uniform vec2 u_noiseScale;
	uniform vec3 u_kernel[64];
	uniform float u_radius;

	uniform float u_outputChannel;
	uniform float u_noise_tiling;

	uniform sampler2D u_fbo_color_texture;
	uniform sampler2D u_fbo_normal_texture;
	uniform sampler2D u_fbo_depth_texture;
	uniform sampler2D u_fbo_roughness_texture;
	uniform sampler2D u_ssao_texture;
	uniform sampler2D u_ssao_texture_blur;

	varying vec2 v_coord;

	float getLinearDepth( float z, float n, float f) {
		
		float EZ  = (2.0 * n * f) / (f + n - z * (f - n));
		float LZ  = (EZ - n) / (f - n);

		return LZ;
	}

	void main() {
		
		float occlusion = texture2D(u_ssao_texture, v_coord).r;
		float occlusion_blur = texture2D(u_ssao_texture_blur, v_coord).r;
		float depth = getLinearDepth(texture2D(u_fbo_depth_texture, v_coord).r, u_near, u_far );
		vec3 viewNormal = normalize( texture2D(u_fbo_normal_texture, v_coord).xyz );
		vec4 color = texture2D(u_fbo_color_texture, v_coord) * (u_enableSSAO == true ? occlusion_blur : 1.0);

		gl_FragColor = (u_outputChannel == 0.0) ? color : 
		(u_outputChannel == 1.0) ? vec4(occlusion) :
		(u_outputChannel == 2.0) ? vec4(occlusion_blur) :
		(u_outputChannel == 3.0) ? vec4(depth,0.0,0.0, 1.0) :
		vec4(vec3(viewNormal), 1.0);
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


\atmos.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	uniform vec4 u_color;
	uniform vec4 u_background_color;
	uniform vec3 u_camera_position;
	uniform float u_time;

	uniform float u_rotation;
	uniform float u_speed;
	uniform float u_SunPos; // should be vec3
	uniform vec3 u_RayOrigin;
	uniform float u_SunIntensity;
	uniform vec3 u_RayleighCoeff;
	uniform float u_RayleighScaleHeight;
	uniform float u_MieCoeff;
	uniform float u_MieScaleHeight;
	uniform float u_MieDirection;
	uniform float u_originOffset;

	#import "atmosphere.inc"

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
	    
		// View direction
		vec3 E = normalize(v_wPosition - u_camera_position);

		if(u_rotation != 0.0)
		E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

		// In meters
		float EarthRadius = 6360e3;
		float AtmosphereRadius = 6420e3;

		// RayLeigh Scattering coefficient 
		vec3 RayLeighScatteringCoeffient = vec3(5.5e-6, 13.0e-6, 22.4e-6);
		// Scale height
		float HR = 8e3;

		// Mie coefficients 
		float MieScatteringCoeffient = u_MieCoeff * 1e-6;
		float MieExtinctionCoeffient = 1.1 * 210e-5;
		// Scale height
		float HM = 1.2e3;

		// Anisotropy of the medium
		float g = max(0.01, min(0.975, u_MieDirection));

		// Ray origin
		vec3 RayOrigin = vec3(0.0, 6372e3 + u_originOffset , 0.0);

		// Sun direction
		vec3 SunPos = vec3(0.0, u_SunPos, -1.0);

		 vec3 color = getSkyColor(
			E,                               // normalized ray direction
			RayOrigin,                       // ray origin
			SunPos,                          // position of the sun
			u_SunIntensity,                   // intensity of the sun
			6371e3,                          // radius of the planet in meters
			6471e3,                          // radius of the atmosphere in meters
			RayLeighScatteringCoeffient,     // Rayleigh scattering coefficient
			MieScatteringCoeffient,          // Mie scattering coefficient
			HR,                              // Rayleigh scale height
			HM,                              // Mie scale height
			g                                // Mie preferred scattering direction
		);

		// Remove gamma
		color = pow( color, vec3(2.2) );
		gl_FragColor = vec4(color, 1.0);
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

\prem.inc

	precision highp float;

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
    
        float a = roughness * 6.0;

		R = (rotationMatrix(vec3(0.0,1.0,0.0),rotation) * vec4(R,1.0)).xyz;

    	if(a < 1.0) return mix(textureCube(u_env_texture, R).rgb, textureCube(u_env_1_texture, R).rgb, a);
        if(a < 2.0) return mix(textureCube(u_env_1_texture, R).rgb, textureCube(u_env_2_texture, R).rgb, a - 1.0);
        if(a < 3.0) return mix(textureCube(u_env_2_texture, R).rgb, textureCube(u_env_3_texture, R).rgb, a - 2.0);
        if(a < 4.0) return mix(textureCube(u_env_3_texture, R).rgb, textureCube(u_env_4_texture, R).rgb, a - 3.0);
        if(a < 5.0) return mix(textureCube(u_env_4_texture, R).rgb, textureCube(u_env_5_texture, R).rgb, a - 4.0);

        return textureCube(u_env_6_texture, R).xyz;
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

\atmosphere.inc	

	// https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/simulating-sky
	// https://developer.nvidia.com/gpugems/GPUGems2/gpugems2_chapter16.html

	#define PI 3.141592
	#define iSteps 16
	#define jSteps 8

	vec2 rsi(vec3 r0, vec3 rd, float sr) {
		// ray-sphere intersection that assumes
		// the sphere is centered at the origin.
		// No intersection when result.x > result.y
		float a = dot(rd, rd);
		float b = 2.0 * dot(rd, r0);
		float c = dot(r0, r0) - (sr * sr);
		float d = (b*b) - 4.0*a*c;
		if (d < 0.0) return vec2(1e5,-1e5);
		return vec2(
			(-b - sqrt(d))/(2.0*a),
			(-b + sqrt(d))/(2.0*a)
		);
	}

	// RayLeigh phase function
	float computeRayleighPhase( float mu )
	{
		return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
	}

	// Mie phase function
	float computeMiePhase( float mu, float g )
	{
		float gg = g * g;
		float a = (1.0 - gg) * (1.0 + mu * mu);
		float b = (2.0 + gg) * pow((1.0 + gg - 2.0 * g * mu), 1.5);

		return 3.0 / (8.0 * PI) * (a / b);
	}

	vec3 getSkyColor(vec3 r, vec3 r0, vec3 pSun, float iSun, float rPlanet, float rAtmos, vec3 kRlh, float kMie, float shRlh, float shMie, float g) {
		// Normalize the sun and view directions.
		pSun = normalize(pSun);
		r = normalize(r);

		//  - Calculate the step size of the primary ray.
		//  - Know the intersection point between the camera ray and the atmosphere
		// 	  so basically: raySphereIntersect(orig, dir, atmosphereRadius)
		vec2 p = rsi(r0, r, rAtmos);
		if (p.x > p.y) return vec3(0,0,0);
		p.y = min(p.y, rsi(r0, r, rPlanet).x);
		float iStepSize = (p.y - p.x) / float(iSteps);

		//  - Calculate the Rayleigh and Mie phases.
		// 	  How much light coming from direction L is scattered in direction V
		float mu = dot(r, pSun);
		float pRlh = computeRayleighPhase(mu);
		float pMie = computeMiePhase(mu, g);

		// Initialize the ray time for each ray
		float iTime = 0.0;
		float jTime = 0.0;

		// Initialize accumulators for Rayleigh and Mie scattering.
		vec3 totalRlh = vec3(0,0,0);
		vec3 totalMie = vec3(0,0,0);

		// Initialize optical depth accumulators for each ray
		float iOdRlh = 0.0;
		float iOdMie = 0.0;
		float jOdRlh = 0.0;
		float jOdMie = 0.0;

		// Sample the primary ray.
		for (int i = 0; i < iSteps; i++) {

			// Calculate the primary ray sample position.
			vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);

			// Calculate the height of the sample.
			float iHeight = length(iPos) - rPlanet;

			// Calculate the optical depth of the Rayleigh and Mie scattering for this step.
			// Using scale height for each scattering type
			float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
			float odStepMie = exp(-iHeight / shMie) * iStepSize;

			// Accumulate optical depth.
			iOdRlh += odStepRlh;
			iOdMie += odStepMie;

			// Calculate the step size of the secondary ray.
			float jStepSize = rsi(iPos, pSun, rAtmos).y / float(jSteps);

			// Sample the secondary ray.
			for (int j = 0; j < jSteps; j++) {

				// Calculate the secondary ray sample position.
				// The origin is the current step of the ray
				// Use r as the sun direction 
				vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);

				// Calculate the height of the sample.
				float jHeight = length(jPos) - rPlanet;

				// Accumulate the optical depth.
				jOdRlh += exp(-jHeight / shRlh) * jStepSize;
				jOdMie += exp(-jHeight / shMie) * jStepSize;

				// Increment the secondary ray time.
				jTime += jStepSize;
			}

			// Calculate attenuation.
			vec3 attn = exp(-(kRlh * (iOdRlh + jOdRlh) + kMie * (iOdMie + jOdMie)));

			// Accumulate scattering.
			totalRlh += odStepRlh * attn * 1.0;
			totalMie += odStepMie * attn * 1.0;

			// Increment the primary ray time.
			iTime += iStepSize;
		}

		// Calculate and return the final color.
		return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
	}

\testpbr.vs

	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform bool u_hasBump;
	uniform float u_bumpScale;
	uniform sampler2D u_height_texture;
	uniform mat4 u_mvp;
	uniform mat4 u_model;

	void main() {

	v_wPosition = (u_model * vec4(a_vertex, 1.0)).xyz;
	v_wNormal = (u_model * vec4(a_normal, 0.0)).xyz;
	v_coord = a_coord;

	vec3 position = a_vertex;

	if(u_hasBump) {
	    vec4 bumpData = texture2D( u_height_texture, v_coord );
	    float vAmount = bumpData.r;
	    position += (v_wNormal * vAmount * u_bumpScale);
	}

	gl_Position = u_mvp * vec4(position, 1.0);
	}

\testpbr.fs

	#extension GL_OES_standard_derivatives : enable
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
	varying vec2 v_coord;

	uniform float u_rotation;
	uniform float u_light_intensity;
	uniform vec3 u_light_color;
	uniform vec3 u_light_position;
	uniform vec3 u_camera_position;
	uniform vec3 u_background_color;
	uniform vec4 u_viewport;
	uniform bool u_show_layers;
	uniform bool u_applyGamma;

	uniform sampler2D u_brdf_texture;
	uniform sampler2D u_brdf_texture_multi;
	uniform samplerCube u_env_texture;
	uniform samplerCube u_env_1_texture;
	uniform samplerCube u_env_2_texture;
	uniform samplerCube u_env_3_texture;
	uniform samplerCube u_env_4_texture;
	uniform samplerCube u_env_5_texture;
	//uniform samplerCube u_env_6_texture;
	//uniform samplerCube u_env_7_texture;

	uniform sampler2D u_albedo_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_roughness_texture;
	uniform sampler2D u_metalness_texture;
	uniform sampler2D u_opacity_texture;
	uniform sampler2D u_height_texture;
	uniform sampler2D u_emissive_texture;
	uniform sampler2D u_ao_texture;

	uniform vec3 u_albedo;
	uniform float u_roughness;
	uniform float u_metalness;
	uniform float u_alpha;
	uniform vec3 u_tintColor;

	uniform float u_ibl_intensity;
	uniform float u_emissiveScale;
	uniform bool u_isEmissive;
	uniform bool u_hasAlpha;	
	uniform bool u_hasNormal;
	uniform bool u_hasAO;
	uniform bool u_hasBump;
	uniform bool u_enable_ao;
	uniform bool u_correctAlbedo;

	uniform bool u_roughnessInBlue;

	uniform vec3 u_reflectance;
	uniform float u_clearCoat;
	uniform float u_clearCoatRoughness;

	// GUI
	uniform bool u_flipX;
	uniform bool u_renderDiffuse;
	uniform bool u_renderSpecular;

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
	

		// Approximation of iorTof0(f0ToIor(f0), 1.5)
		// This assumes that the clear coat layer has an IOR of 1.5
		//return clamp(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998, 0.0, 1.0);
	}

	void updateVectors (inout PBRMat material) {

		vec3 v = normalize(u_camera_position - v_wPosition);
		vec3 n = normalize( v_wNormal );

		#ifdef HAS_NORMAL_MAP
			vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
			n = normalize( perturbNormal( v_wNormal, v, v_coord, normal_map ) );
		#endif

		vec3 l = normalize(u_light_position - v_wPosition);
		vec3 h = normalize(v + l);

		material.reflection = normalize(reflect(v, n));

		if(u_flipX)
			material.reflection.x = -material.reflection.x;
		material.N = n;
		material.V = v;
		material.H = h;
		material.NoV = clamp(dot(n, v), 0.0, 1.0) + 1e-6;
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
		
		float metallic = max(0.02, u_metalness);
		#ifdef HAS_METALNESS_MAP
			metallic *= texture2D(u_metalness_texture, v_coord).r;
		#endif

		vec3 baseColor = u_albedo;
		#ifdef HAS_ALBEDO_MAP
			baseColor *= texture2D(u_albedo_texture, v_coord).rgb;
		#endif

		if( u_correctAlbedo )
			baseColor = pow(baseColor, vec3(GAMMA)); // Transform Base Color to linear space


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
		float roughness = u_roughness;
		#ifdef HAS_ROUGHNESS_MAP

			if(u_roughnessInBlue)
				roughness *= texture2D(u_roughness_texture, v_coord).b;
			else
				roughness *= texture2D(u_roughness_texture, v_coord).r;
		#endif

		if(false)
			roughness = rand(v_wPosition.xz);

		roughness = max(roughness, MIN_ROUGHNESS);	
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
		// float D = D_GGX_2(material.linearRoughness, material.NoH, material.N, material.H);
		// float D = Geometric_Smith_Schlick_GGX_(material.linearRoughness, material.NoV, material.NoL);

		// Visibility Function (shadowing/masking)
		float V = G_Smith( material.NoV, material.NoL, material.linearRoughness );
		// float V = V_SmithGGXCorrelated( material.NoV, material.NoL, material.linearRoughness );
		
		// Fresnel
		vec3 F = F_Schlick( material.LoH, material.f0 );

		vec3 spec = (D * V) * F;
		//spec /= (4.0 * material.NoL * material.NoV + 1e-6);

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

		float a = roughness * 7.0;

		R = (rotationMatrix(vec3(0.0,1.0,0.0),rotation) * vec4(R,1.0)).xyz;

		vec3 color;

		if(a < 1.0) color = mix(textureCube(u_env_texture, R).rgb, textureCube(u_env_1_texture, R).rgb, a);
		else if(a < 2.0) color = mix(textureCube(u_env_1_texture, R).rgb, textureCube(u_env_2_texture, R).rgb, a - 1.0);
		else if(a < 3.0) color = mix(textureCube(u_env_2_texture, R).rgb, textureCube(u_env_3_texture, R).rgb, a - 2.0);
		else if(a < 4.0) color = mix(textureCube(u_env_3_texture, R).rgb, textureCube(u_env_4_texture, R).rgb, a - 3.0);
		else if(a < 5.0) color = mix(textureCube(u_env_4_texture, R).rgb, textureCube(u_env_5_texture, R).rgb, a - 4.0);
		//else if(a < 6.0) color = mix(textureCube(u_env_5_texture, R).rgb, textureCube(u_env_6_texture, R).rgb, a - 5.0);
		//else if(a < 7.0) color = mix(textureCube(u_env_6_texture, R).rgb, textureCube(u_env_7_texture, R).rgb, a - 6.0);
		//else color = textureCube(u_env_7_texture, R).xyz;

		else color = textureCube(u_env_5_texture, R).xyz;

		if(u_applyGamma)
		color = pow(color, vec3(1.0/2.2));

		return color;
	}
	
	vec3 BRDF_Specular_Multiscattering ( const in PBRMat material) {
		
		vec3 F = F_Schlick( material.NoV, material.f0 );
		vec2 brdf = texture2D( u_brdf_texture, vec2(material.NoV, material.roughness) ).rg;
		vec3 FssEss = F * brdf.x + brdf.y;
		float Ess = brdf.x + brdf.y;
		float Ems = 1.0 - Ess;
		vec3 Favg = F + ( 1.0 - F ) * 0.047619; // 1/21
		vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
		vec3 multiScatter = Fms * Ems * 1.0;

		// Prefiltered radiance
		vec3 radiance = prem(material.reflection, material.linearRoughness, u_rotation);
		// Cosine-weighted irradiance
		vec3 irradiance = prem(material.reflection, 1.0, u_rotation);
		vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

		return radiance * FssEss + material.diffuseColor * cosineWeightedIrradiance + cosineWeightedIrradiance * multiScatter;
	}

	vec2 prefilteredDFG(float NoV, float roughness) {
	    // Karis' approximation based on Lazarov's
	    const vec4 c0 = vec4(-1.0, -0.0275, -0.572,  0.022);
	    const vec4 c1 = vec4( 1.0,  0.0425,  1.040, -0.040);
	    vec4 r = roughness * c0 + c1;
	    float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
	    return vec2(-1.04, 1.04) * a004 + r.zw;
	    // Zioma's approximation based on Karis
	    // return vec2(1.0, pow(1.0 - max(roughness, NoV), 3.0));
	}

	void ibl (PBRMat material, inout vec3 Fd, inout vec3 Fr) {
	
		/*vec3 radiance = prem(material.reflection, material.roughness, u_rotation);
		vec3 irradiance = prem(material.reflection, 1.0, u_rotation);
		vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
		vec3 multiScatter = BRDF_Specular_Multiscattering( material );*/

		if(u_renderDiffuse) {
			Fd = prem(material.reflection, 1.0, u_rotation) * material.diffuseColor;
		//	Fd += cosineWeightedIrradiance * multiScatter;
		}
		vec3 Lld = prem(material.reflection, material.roughness, u_rotation);
		vec2 popo = texture2D( u_brdf_texture, vec2(material.NoV, material.roughness) ).rg;
		vec2 Ldfg = prefilteredDFG(material.NoV, material.roughness);
		float f90 = 1.0; // optimization purposes
		vec3 F = F_Schlick( material.NoV, material.f0 );
		if(u_renderSpecular)
			Fr = (material.f0 * Ldfg.x + 1.5 * Ldfg.y) * Lld;
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
		vec3 radiance = prem(material.reflection, material.linearRoughness * 0.55, u_rotation);
		// Cosine-weighted irradiance
		vec3 irradiance = prem(material.reflection, 1.0, u_rotation);

		// Multiple scattering
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

	// still no energy compensation
	void do_lighting(inout PBRMat material, inout vec3 color)
	{
		// INDIRECT LIGHT: IBL ********************

		vec3 Fd_i = vec3(0.0);
		vec3 Fr_i = vec3(0.0);
		ibl_multiscattering(material, Fd_i, Fr_i);
		
		// CLEAT COAT LOBE ************************

		float Fcc = F_Schlick(material.NoV, 0.04) * material.clearCoat;
		vec3 att = vec3(1.0) - Fcc;

		// coatBump can change this
		vec3 R = material.reflection;

		if(u_hasBump) {
			vec3 coat_bump = texture2D( u_height_texture, v_coord ).xyz;
			coat_bump = normalize( perturbNormal( material.reflection, -material.V, v_coord, coat_bump ) );
			R = coat_bump;
		}

		// apply tint
		Fd_i *= mix(vec3(1.0), u_tintColor, material.clearCoat);
		Fr_i *= att;
		Fd_i *= (att * att);

		// apply clear coat
		vec3 indirect = Fr_i + Fd_i;
		indirect += prem(R, material.clearCoatRoughness, u_rotation) * Fcc;

		// Apply ambient oclusion 
		if(u_hasAO && u_enable_ao)
			indirect *= texture2D(u_ao_texture, v_coord).r;
		
		// DIRECT LIGHT ***************************

		vec3 Fr_d = specularBRDF( material );
		// vec3 Fd = material.diffuseColor * Fd_Lambert();
		vec3 Fd_d = material.diffuseColor * Fd_Burley (material.NoV, material.NoL, material.LoH, material.linearRoughness);
		vec3 direct = Fr_d + Fd_d;

		// COMPOSE

		vec3 lightParams = material.NoL * u_light_color * u_light_intensity;
		color  =   indirect * u_ibl_intensity;// * u_background_color;
		color +=  direct   * lightParams;
	}

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
		  
		
		if(u_show_layers)
		{
			const int channels = 6; // 5: add one extra for limits
			float x = (gl_FragCoord.x / u_viewport.z);
			float y = (gl_FragCoord.y / u_viewport.w);

			if(x < 0.25)
				color = vec3(material.baseColor);
			else if(x > 0.25 && x < 0.5)
				color = vec3(material.roughness);
			else if(x > 0.5 && x < 0.75)
				color = vec3(material.metallic);
			else
				color = vec3(material.reflectance);
			
		}
        
		gl_FragColor = vec4(color, alpha);
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
			
		gl_FragColor = color;
	}

	
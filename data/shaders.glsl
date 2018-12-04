\shaders

// Basic shaders
flat default.vs default.fs
tex default.vs tex.fs
fx screen_shader.vs exposure.fs

// Cubemap shaders
skyboxExpo default.vs skyboxExpo.fs
sphereMap default.vs sphereMap.fs
mirroredSphere default.vs mirroredSphere.fs
atmos default.vs atmos.fs

// Cubemap FX Shaders
cubemapBlur cubemapBlur.vs cubemapBlur.fs
blurTest blurTest.vs blurTest.fs
fromSphere screen_shader.vs fromSphere.fs
fromPanoramic screen_shader.vs fromPanoramic.fs

// Texture FX Shaders
glow screen_shader.vs glow.fs
luminance screen_shader.vs luminance.fs

// PBR Shaders
brdfIntegrator brdf.vs brdf.fs
pbr pbr.vs pbr.fs

//
// Default vertex shader for "almost" every fragment shader
//

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
// Default vertex shader for "almost" every fragment shader
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

//
// Basic texture shader
//

\tex.fs
	precision highp float;
	varying vec2  v_coord;
	uniform sampler2D u_color_texture;
	
	void main(){
		gl_FragColor = texture2D(u_color_texture, v_coord);
	}

//
// Screen shader 
//

\screen_shader.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec2 a_coord;
	varying vec2 v_coord;
	void main() {
		v_coord = a_coord;
		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
	}

//
// Exposure shader used only in 2D textures
//

\exposure.fs

	precision highp float;
    varying vec2 v_coord;

	uniform float u_tonemapping;
	uniform float u_exposure;
	uniform float u_offset;
    uniform vec4 u_color;
	uniform sampler2D u_color_texture;
	uniform sampler2D u_last_frame;

	uniform float u_lum;
	uniform vec4 u_average;
	uniform float u_logMean;
	uniform float u_maxLum;

	#import "tonemap.inc"

    void main() {

       	vec3 color = texture2D(u_color_texture, v_coord).rgb;

		// apply exposure
		color *= pow( 2.0, u_exposure );

		float v = u_tonemapping; 

		// tone mapping 
		if(v == 1.0)
			color = tonemapReinhard( color );
		else if(v == 2.0)
			color = tonemapUncharted2( color );
		else if(v == 3.0) {
			color = exponential( color, u_logMean );
		}
		else if(v == 4.0)
			color = logTM( color, u_maxLum );
		else if(v == 5.0)
			color = atmosTonemap( color );

		// apply offset
		color += vec3(u_offset);
		// delinearize
		color = pow(color, vec3(1.0/GAMMA));

        gl_FragColor = vec4(color, 1.0);
    }

//
// Luminance shader
//

\luminance.fs

	precision highp float;
	
	uniform sampler2D u_texture;
	varying vec2 v_coord;
	
	void main() {
		vec4 color = vec4(0.0);
		int k = 0;
		float maxLum = -1.0;
		
		#ifdef INPUT_TEX_WIDTH
			const float width = float(INPUT_TEX_WIDTH);
		#endif
		#ifdef INPUT_TEX_HEIGHT
			const float height = float(INPUT_TEX_HEIGHT);
		#endif

		for(float i = 0.5; i < width; i+=30.0)
			for(float j = 0.5; j < height; j+=30.0)
			{
				vec2 coord = vec2(i, j) / vec2(width, height);
				vec4 pixelColor = texture2D(u_texture, coord );
				color += pixelColor;
				k++;

				float lum = 0.2126*pixelColor.r + 0.7152*pixelColor.g + 0.0722*pixelColor.b;
				
				if(lum > maxLum)
					maxLum = lum;
			}

		vec4 averageColor = color/float(k);
		averageColor.a = maxLum;

		gl_FragColor = averageColor;
	}

//
// Shader used to show skybox 
//

\skyboxExpo.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_rotation;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;

	uniform samplerCube u_color_texture;

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
		E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

	    vec4 color = textureCube(u_color_texture, E);
		// color = pow(color, vec4(2.2));
	    gl_FragColor = color;
	}

//
// Shader used to convert spheremap to cubemap
//

\fromSphere.fs

		precision highp float;
		varying vec2 v_coord;
		uniform vec4 u_color;
		uniform vec4 background_color;
		uniform vec3 u_camera_position;
		uniform sampler2D u_color_texture;
		uniform mat3 u_rotation;

		vec2 getSphericalUVs(vec3 dir)
		{
			dir = normalize(dir);
			dir = -dir;
            float d = sqrt(dir.x * dir.x + dir.y * dir.y);
			float r = 0.0;

			if(d > 0.0)
				r = 0.159154943 * acos(dir.z) / d;

	    	float u = 0.5 + dir.x * (r);
			float v = 0.5 + dir.y * (r);

			return vec2(u, v);
		}

		void main() {

			vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
			vec3 dir = vec3( uv - vec2(0.5), 0.5 );
			dir = u_rotation * dir;
			// dir.z += u_correction;

			// use dir to calculate spherical uvs
			vec2 spherical_uv = getSphericalUVs( dir );
			vec4 color = texture2D(u_color_texture, spherical_uv);
		    gl_FragColor = color;
		}

//
// Shader used to convert panoramicmap to cubemap
//

\fromPanoramic.fs

		precision highp float;
		varying vec2 v_coord;
		uniform vec4 u_color;
		uniform vec4 background_color;
		uniform vec3 u_camera_position;
		uniform sampler2D u_color_texture;
		uniform mat3 u_rotation;

		#define PI 3.1415926535897932384626433832795

		vec2 getPanoramicUVs(vec3 dir)
		{
			dir = -normalize(dir);

	    	float u = 1.0 + (atan(dir.x, -dir.z) / PI);
			float v = acos(-dir.y) / PI;

			return vec2(u/2.0, v);
		}

		void main() {

			vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
			vec3 dir = vec3( uv - vec2(0.5), 0.5 );
			dir = u_rotation * dir;

			vec2 panoramic_uv = getPanoramicUVs( dir );
			vec4 color = texture2D(u_color_texture, panoramic_uv);
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
// Reflect environment to an sphere (+ Exposure)
//

\mirroredSphere.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;
	uniform vec4 background_color;
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
		gl_FragColor = u_color * color;
	}

//
// Blur cubemap depending on the roughness
//

\cubemapBlur.vs

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

\cubemapBlur.fs

	precision highp float;

	varying vec3 v_dir;

	uniform samplerCube u_color_texture;
	uniform mat3 u_rotation;
	uniform float u_roughness;

	#import "brdf.inc"
	#define PI 3.1415926535897932384626433832795

	void main() {

		vec3 dir = v_dir;
		vec3 N = normalize(u_rotation * dir); // V

		#ifdef N_SAMPLES
			const int SAMPLES = N_SAMPLES;
		#endif


		vec4 prefiltered = vec4(0.0);
		float TotalWeight = 0.0;

		for(int i = 0; i < SAMPLES; i++) {

			// get spherical cx
			vec2 polar_i = Fib( i, SAMPLES );

			// get [0,1] sample (lambert)
			vec2 Xi = vec2(polar_i.y / (2.0 * PI), cos(polar_i.x));

			// get 3d vector
			vec3 H = (importanceSampleGGX(Xi, u_roughness, N));

			// its an hemisphere so only vecs with pos NdotH
			float NdotH = max( dot(H, N), 0.0 );

			// get pixel color from direction H and add it
			if(NdotH > 0.0) {
				vec4 Li = textureCube(u_color_texture, H);
	            prefiltered += NdotH * Li;
				TotalWeight += NdotH;
        	}
		}

		// promedio
		gl_FragColor = prefiltered / TotalWeight;
	}

\blurTest.vs

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

\blurTest.fs

	precision highp float;

	uniform samplerCube u_color_texture;
	uniform mat3 u_cameras[6]; 
	uniform mat3 u_rotation;
	uniform float u_roughness;
	uniform vec4 u_viewport; 

	varying vec3 v_dir;
	varying vec2 v_coord;

	const float size = 256.0;

	#import "brdf.inc"
	#define PI 3.1415926535897932384626433832795

	void main() {

		vec3 V = normalize( u_rotation * v_dir ); // V

		vec4 color = vec4(0.0);
		float TotalWeight = 0.0;
		float samples = 0.0;
		float alphaRoughness = u_roughness * u_roughness;
		float roughnessSq = alphaRoughness * alphaRoughness;

		// (gl_FragCoord.xy) / vec2(size, size) = v_coord

		for(float i = 0.5; i < size; i++)
		for(float j = 0.5; j < size; j++) {

			// Get pixel
			vec2 r_coord = vec2(i, j) / vec2(size, size);
			// Get 3d vector
			vec3 direction = vec3( r_coord - vec2(0.5), 0.5 );

			// Use all faces
			for(int f = 0; f < 6; f++) {

				mat3 _camera_rotation = u_cameras[f];
				vec3 N = normalize( _camera_rotation * direction );
				vec3 H = importanceSampleGGX(r_coord, u_roughness, N);
				vec3 L = 2.0 * dot( N, H ) * H - N;
				float weight = max( dot(V, L), 0.0);

				if(weight > 0.99) {
					color += textureCube(u_color_texture, L) * weight;
					TotalWeight += weight;
					samples ++;
				}
			}
		}

		gl_FragColor = color / TotalWeight;
		// gl_FragColor = textureCube(u_color_texture, V);
	}

//
// Get BRDF LUT Texture
//

\brdf.vs

	precision highp float;

	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;

	varying vec2 v_coord;
	varying vec3 v_vertex;

	void main(){
		v_vertex = a_vertex;
		v_coord  = a_coord;
		vec3 pos = v_vertex * 2.0 - vec3(1.0);
		gl_Position = vec4(pos, 1.0);
	}

\brdf.fs

	precision highp float;

	varying vec2 v_coord;
	varying vec3 v_vertex;

	#import "brdf.inc"

	#define SAMPLES 1024

	void main() {

		float roughness = v_coord.y;
		float NdotV = v_coord.x;

		float PI = 3.1415926535897932384626433832795;
		vec3 V = vec3( sqrt(1.0 - NdotV * NdotV), 0.0, NdotV );
		vec3 N = vec3(0.0, 0.0, 1.0);

		float A = 0.0;
		float B = 0.0;

		for(int i = 0; i < SAMPLES; i++) {

			vec2 polar_i = Fib( i, SAMPLES );
			vec2 Xi = vec2(polar_i.y / (2.0 * PI), cos(polar_i.x));
			vec3 H = importanceSampleGGX(Xi, roughness, N);
			vec3 L = 2.0 * dot( V, H ) * H - V;

			float NdotL = clamp( L.z, 0.001, 1.0);
			float NdotH = clamp( H.z, 0.0001, 1.0);
			float VdotH = clamp( dot(V, H), 0.001, 1.0);

			if(NdotL > 0.0) {
				float G = G_Smith( roughness, NdotV, NdotL );
	            float G_vis = G * VdotH / (NdotH * NdotV);
				float Fc = pow( 1.0 - VdotH, 5.0 );

				A += ( 1.0 - Fc ) * G_vis;
				B += ( Fc ) * G_vis;
        	}
		}

		vec2 result = vec2(A, B)/ float(SAMPLES);
		gl_FragColor = vec4(result, 0.0, 1.0);
	}

//
// PBR Illumination 
//

\pbr.vs

	precision highp float;
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

\pbr.fs
    
    #extension GL_OES_standard_derivatives : enable
	precision highp float;

    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    varying vec2 v_coord;
    
	uniform float u_time;
	uniform float u_rotation;
    uniform float u_light_intensity;
    uniform vec3 u_light_color;
	uniform vec3 u_light_position;
    uniform vec3 u_camera_position;
    uniform vec4 background_color;

    uniform sampler2D u_brdf_texture;
    uniform samplerCube u_env_texture;
    uniform samplerCube u_env_1_texture;
    uniform samplerCube u_env_2_texture;
    uniform samplerCube u_env_3_texture;
    uniform samplerCube u_env_4_texture;
    uniform samplerCube u_env_5_texture;
    
    uniform sampler2D u_albedo_texture;
	uniform sampler2D u_normal_texture;
    uniform sampler2D u_roughness_texture;
    uniform sampler2D u_metalness_texture;
	uniform sampler2D u_opacity_texture;
	uniform sampler2D u_emissive_texture;
	uniform sampler2D u_ao_texture;

    uniform vec3 u_albedo;
    uniform float u_roughness;
    uniform float u_metalness;
	uniform float u_channel;

	uniform float u_ibl_intensity;

	uniform bool u_isEmissive;
	uniform float u_emissiveScale;
	uniform bool u_hasAlpha;	
	uniform bool u_hasNormal;
	uniform bool u_hasAO;
	uniform bool u_enable_ao;
	uniform bool u_correctAlbedo;
    
	struct PBRInfo
	{
		float NdotL;                  // cos angle between normal and light direction
		float NdotV;                  // cos angle between normal and view direction
		float NdotH;                  // cos angle between normal and half vector
		float LdotH;                  // cos angle between light direction and half vector
		float VdotH;                  // cos angle between view direction and half vector
		float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
		float metalness;              // metallic value at the surface
		vec3 reflectance0;            // full reflectance color (normal incidence angle)
		vec3 reflectance90;           // reflectance color at grazing angle
		float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
		vec3 diffuseColor;            // color contribution from diffuse lighting
		vec3 specularColor;           // color contribution from specular lighting
	};

	#import "bump.inc"
    #import "ggx.inc"
	#import "prem.inc"
	#import "fresnel.inc"
        
	#define PI 3.1415926535897932384626433832795
	#define FDIELECTRIC 0.04

    const float c_MinRoughness = 0.04;
    
	vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
    {
        vec3 brdf = texture2D(u_brdf_texture, vec2(pbrInputs.NdotV, pbrInputs.perceptualRoughness)).rgb;

		// Get values from brdf texture
		float x_brdf = brdf.x;
		float y_brdf = brdf.y;//pow(brdf.y, 2.0);
        
        // Sample diffuse irradiance at normal direction.
		vec3 diffuseLight = prem(reflection, 1.0, u_rotation);
		// Sample pre-filtered specular reflection environment
		vec3 specularLight = prem(reflection, pbrInputs.perceptualRoughness, u_rotation);

		// The following equation models the Fresnel reflectance term of the spec equation (aka F())
		vec3 F = specularReflection(pbrInputs);

		vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
        vec3 specular =  specularLight * (pbrInputs.specularColor * x_brdf + y_brdf);
		vec3 color = diffuse + specular;

		if(u_channel == 1.0)
			color = diffuse;
		else if(u_channel == 2.0)
			color = specular;

        return color;
    }

	vec3 getLightContribution(PBRInfo pbrInputs)
	{
		vec3 lightScale = vec3(u_light_intensity);

		// The following equation models the Fresnel reflectance term of the spec equation (aka F())
		vec3 F = specularReflection(pbrInputs);
		// This calculates the specular geometric attenuation (aka G()),
		float G = geometricOcclusion(pbrInputs);
		// Calculate normal distribution
		float D = microfacetDistribution(pbrInputs);

		vec3 diffuseContribution = (1.0 - F) * diffuse(pbrInputs);
		vec3 specContribution = F * G * D / max(0.001, (4.0 * pbrInputs.NdotL * pbrInputs.NdotV));

		// Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
    	return pbrInputs.NdotL * u_light_color * lightScale * (diffuseContribution + specContribution);
	}
	
	void main() {
        
		// Get Roughness
        float perceptualRoughness = u_roughness;
		#ifdef HAS_ROUGHNESS_MAP
			perceptualRoughness = texture2D(u_roughness_texture, v_coord).r;
		#endif
        perceptualRoughness = max(c_MinRoughness, perceptualRoughness);
        float alphaRoughness = perceptualRoughness * perceptualRoughness;
		
		// Get Metalness
        float metallic = u_metalness;
		#ifdef HAS_METALNESS_MAP
			metallic = texture2D(u_metalness_texture, v_coord).r;
		#endif

        vec3 baseColor = u_albedo;
		#ifdef HAS_ALBEDO_MAP
			baseColor = texture2D(u_albedo_texture, v_coord).rgb;
		#endif
		
		if( u_correctAlbedo )
			baseColor = pow(baseColor, vec3(GAMMA));

        vec3 f0 = vec3(FDIELECTRIC);
		vec3 diffuseColor = mix(baseColor , f0, metallic);
		vec3 specularColor = mix(f0, baseColor, metallic);
        
        // Compute reflectance.
        // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
        // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
        float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
        float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
        vec3 specularEnvironmentR0 = specularColor.rgb;
        vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;
        
        vec3 v = normalize(v_wPosition - u_camera_position);    	// Vector from surface point to camera
        vec3 n = -normalize( v_wNormal ); // normal at surface point

        #ifdef HAS_NORMAL_MAP
			vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
	        n = -normalize( perturbNormal( v_wNormal, v, v_coord, normal_map ) ); // normal at surface point
		#endif

		vec3 l = -normalize(u_light_position - v_wPosition);  			// Vector from surface point to light
		vec3 h = normalize(l+v);                                	// Half vector between both l and v
        vec3 reflection = normalize(reflect(-v, n));
        
        float NdotL = clamp(dot(n, l), 0.001, 1.0);
        float NdotV = clamp(dot(n, v), 0.001, 1.0);
        float NdotH = clamp(dot(n, h), 0.0, 1.0);
        float LdotH = clamp(dot(l, h), 0.0, 1.0);
        float VdotH = clamp(dot(v, h), 0.0, 1.0);
        
        PBRInfo pbrInputs = PBRInfo(
			NdotL,
			NdotV,
			NdotH,
			LdotH,
			VdotH,
			perceptualRoughness,
			metallic,
			specularEnvironmentR0,
			specularEnvironmentR90,
			alphaRoughness,
			diffuseColor,
			specularColor
		);
        
		vec3 lightContribution = getLightContribution(pbrInputs);
       	vec3 IBL = getIBLContribution(pbrInputs, n, reflection) * u_ibl_intensity;

		// Apply ambient oclusion 
		if(u_hasAO && u_enable_ao)
			IBL *= texture2D(u_ao_texture, v_coord).r;

        vec4 color = vec4(IBL + lightContribution, 1.0);

		if(u_hasAlpha)
			color.a = texture2D(u_opacity_texture, v_coord).r;

		// Apply light from material (emissiveColor)
		if(u_isEmissive)
		 	color.rgb += texture2D(u_emissive_texture, v_coord).rgb * u_emissiveScale;
	
		gl_FragColor = color;
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
    
        float a = roughness * 5.0;

		R = (rotationMatrix(vec3(0.0,1.0,0.0),rotation) * vec4(R,1.0)).xyz;

    	if(a < 1.0) return mix(textureCube(u_env_texture, R).rgb, textureCube(u_env_1_texture, R).rgb, a);
        if(a < 2.0) return mix(textureCube(u_env_1_texture, R).rgb, textureCube(u_env_2_texture, R).rgb, a - 1.0);
        if(a < 3.0) return mix(textureCube(u_env_2_texture, R).rgb, textureCube(u_env_3_texture, R).rgb, a - 2.0);
        if(a < 4.0) return mix(textureCube(u_env_3_texture, R).rgb, textureCube(u_env_4_texture, R).rgb, a - 3.0);
        if(a < 5.0) return mix(textureCube(u_env_4_texture, R).rgb, textureCube(u_env_5_texture, R).rgb, a - 4.0);

        return textureCube(u_env_5_texture, R).xyz;
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
	// alphaRoughness as input as originally proposed in [2].
	float geometricOcclusion(PBRInfo pbrInputs)
	{
		float NdotL = pbrInputs.NdotL;
		float NdotV = pbrInputs.NdotV;
		float r = pbrInputs.alphaRoughness;

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
		float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
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
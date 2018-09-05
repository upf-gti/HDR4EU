\shaders

flat default.vs default.fs
tex default.vs tex.fs
depth default.vs depth.fs
fx screen_shader.vs exposure.fs

skyboxExpo default.vs skyboxExpo.fs
sphereMap default.vs sphereMap.fs

brdfIntegrator brdf.vs brdf.fs
fromSphere screen_shader.vs fromSphere.fs
fromPanoramic screen_shader.vs fromPanoramic.fs
cubemapBlur cubemapBlur.vs cubemapBlur.fs
glow screen_shader.vs glow.fs

mirroredSphere default.vs mirroredSphere.fs
pbr pbr.vs pbr.fs
pbrMat pbr.vs pbrMatrix.fs

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
// Basic depth shader
//

\depth.fs
	precision highp float;
	varying vec3 v_wPosition;
	varying vec2 v_coord;

	uniform float u_near;
	uniform float u_far;

	float LinearizeDepth(float z) 
	{
		float n = 0.1; 
		float f = 10000.0; 

		float EZ = (2.0 * n * f) / (f + n - z * (f - n));
		float LZ = (EZ - n) / (f - n);
		float LZ2 = EZ / f;
		
		return LZ2;
	}
	
	void main(){
		
		float depth = LinearizeDepth(gl_FragCoord.z);
    	gl_FragColor = vec4(depth, 0.0, 0.0, 1.0);
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
    uniform float u_average_lum;
	uniform sampler2D u_color_texture;

	#define GAMMA 2.2

	float A = 0.15;
	float B = 0.50;
	float C = 0.10;
	float D = 0.20;
	float E = 0.02;
	float F = 0.30;
	float W = 11.2;
	float E_BIAS = 2.0;

	vec4 Uncharted2Tonemap(vec4 color)
	{
		return ((color*(A*color+C*B)+D*E)/(color*(A*color+B)+D*F))-E/F;
	}

	vec4 tonemapReinhard(vec4 color) {
		
		// Simpler
		// return color / (color + vec4(1.0));
		float scale = 0.08;
		float u_lumwhite2 = 1000.0;

		vec3 rgb = color.xyz;
		float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
		
		// scaled luminance
		float L = (scale / u_average_lum) * lum; // scale / u_average
		float Ld = (L * (1.0 + L / u_lumwhite2)) / (1.0 + L);
		rgb = (rgb / lum) * Ld;
		return vec4(rgb, color.a);
	}

    void main() {

       	vec4 color = texture2D(u_color_texture, v_coord);

		// vec4 color = fxaa(u_color_texture, v_coord, vec2(4096.0, 3666.0));

		/*
		vec2 offset = vec2(0.005);

		vec4 center = texture2D(u_color_texture, v_coord);
		vec4 sum = vec4(0.0);
			   sum += texture2D(u_color_texture, v_coord + offset * -4.0) * 0.05/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * -3.0) * 0.09/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * -2.0) * 0.12/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * -1.0) * 0.15/0.98;
			   sum += center * 0.16/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * 4.0) * 0.05/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * 3.0) * 0.09/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * 2.0) * 0.12/0.98;
			   sum += texture2D(u_color_texture, v_coord + offset * 1.0) * 0.15/0.98;
		color = sum;
		*/

		// apply exposure
		color *= pow( 2.0, u_exposure );

		// tone mapping test
		if(u_tonemapping == 1.0)
			color = tonemapReinhard( color );
		else if(u_tonemapping == 2.0)
			color = Uncharted2Tonemap( E_BIAS * color );

		// apply offset
		color += vec4(u_offset);
		// delinearize
		color = pow(color, vec4(1.0/GAMMA));

        gl_FragColor = color;
    }

//
// Shader used to show skybox 
//

\skyboxExpo.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_exposure;
	uniform float u_offset;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture;

	#define GAMMA 2.2

	void main() {
	    vec3 E = u_camera_position - v_wPosition;
		E.x = -E.x;
	    E = normalize(E);

	    vec4 color = textureCube(u_color_texture, E);
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
	uniform float u_exposure;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform sampler2D u_color_texture;
	uniform float u_fov;

	//u_fov = arctan(r/d);

	void main() {
	    vec3 E = v_wPosition - u_camera_position;
	    E = normalize(E);

	    float d = sqrt(E.x * E.x + E.y * E.y);
		float r = 0.0;

		if(d > 0.0)
			r = 0.159154943 * acos(E.z) / d;

	    float u = 0.5 + E.x * r;
		float v = 0.5 + E.y * r;

	    vec2 spherical_uv = vec2(u, v);
	    vec4 color = texture2D(u_color_texture, spherical_uv);

	    // apply exposure to sphere map
	    gl_FragColor = color;// * pow( 2.0, u_exposure );
	}

//
// Reflect environment to an sphere (+ Exposure)
//

\mirroredSphere.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_exposure;
	uniform float u_offset;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture;

	#define GAMMA 2.2

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

	varying vec3 v_dir;

	void main() {
		vec2 uv = vec2( a_coord.x, 1.0 - a_coord.y );
		v_dir = vec3( uv - vec2(0.5), 0.5 );
		gl_Position = vec4(vec3(a_coord * 2.0 - 1.0, 0.5), 1.0);
	}

\cubemapBlur.fs

	precision highp float;

	varying vec3 v_dir;

	uniform samplerCube u_color_texture;
	uniform mat3 u_rotation;
	uniform float u_roughness;

	#import "fibonacci.inc"
	#import "importanceSampleGGX.inc"
	#define PI 3.1415926535897932384626433832795

	void main() {

		vec3 V = normalize(u_rotation * v_dir);
		vec3 N = V;

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
			float NdotH = clamp( dot(H, N), 0.0, 1.0);

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

//
// Get BRDF Texture (red/green)
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

	#import "fibonacci.inc"
	#import "importanceSampleGGX.inc"
	#import "ggx.inc"

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

			float NdotL = clamp( L.z, 0.0, 1.0);
			float NdotH = clamp( H.z, 0.0, 1.0);
			float VdotH = clamp( dot(V, H), 0.0, 1.0);

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
    uniform mat4 u_mvp;
    uniform mat4 u_model;
    void main() {
		v_wPosition = (u_model * vec4(a_vertex, 1.0)).xyz;
		v_wNormal = (u_model * vec4(a_normal, 0.0)).xyz;
        v_coord = a_coord;
        gl_Position = u_mvp * vec4(a_vertex, 1.0);
    }

\pbr.fs
    
    #extension GL_OES_standard_derivatives : enable
	precision highp float;

    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    varying vec2 v_coord;
    
    uniform float u_exposure;
	uniform float u_time;
	uniform float u_offset;
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
	uniform bool u_hasAlpha;	
	uniform bool u_isEmissive;
	uniform float u_channel;
	uniform bool u_enable_ao;
    
	#import "bump.inc"
    #import "sgm.inc"
	#import "ggx.inc"
	#import "prem.inc"
	#import "fresnel.inc"
        
	#define PI 3.1415926535897932384626433832795
	#define FDIELECTRIC 0.04

    const float c_MinRoughness = 0.04;
	const float c_MinMetalness = 0.01;
    
	vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
    {
        // Get values from brdf texture
		float x_brdf = pbrInputs.NdotV;
		float y_brdf = pbrInputs.perceptualRoughness;

        vec3 brdf = texture2D(u_brdf_texture, vec2(x_brdf, y_brdf)).rgb;
        
        // Sample diffuse irradiance at normal direction.
		vec3 diffuseLight = prem(n, 1.0);
		// Sample pre-filtered specular reflection environment
		vec3 specularLight = prem(reflection, pbrInputs.perceptualRoughness);
        
        vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
		
        vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);
		vec3 color = diffuse + specular;

		if(u_channel == 1.0)
			color = diffuse;
		else if(u_channel == 2.0)
			color = specular;

        return color;
    }

	vec3 getDirectLighting(PBRInfo pbrInputs, vec3 Lo, vec3 Li, vec3 N)
	{
		vec3 Lradiance = vec3(u_light_intensity);

		// Half-vector between Li and Lo.
		vec3 Lh = normalize(Li + Lo);

		// Calculate angles between surface normal and various light vectors.
		float cosLi = pbrInputs.NdotL;
		float cosLo = pbrInputs.NdotV;
		float cosLh = max(0.0, dot(N, Lh));

		// vec3 F0 = mix(vec3(FDIELECTRIC), pbrInputs.diffuseColor, pbrInputs.metalness);

		// Calculate Fresnel term for direct lighting. 
		vec3 F = fresnelGDC(pbrInputs.specularColor, pbrInputs.NdotV);
		// Calculate normal distribution for specular BRDF.
		float D = ndfGGX(pbrInputs.alphaRoughness, pbrInputs.NdotV);
		// Calculate geometric attenuation for specular BRDF.
		float G = gaSchlickGGX(cosLi, cosLo, pbrInputs.perceptualRoughness);

		// Diffuse scattering happens due to light being refracted multiple times by a dielectric medium.
		// Metals on the other hand either reflect or absorb energy, so diffuse contribution is always zero.
		// To be energy conserving we must scale diffuse BRDF contribution based on Fresnel factor & metalness.
		vec3 kd = mix(vec3(1.0) - F, vec3(0.0), pbrInputs.metalness);

		// Lambert diffuse BRDF.
		// https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
		vec3 diffuseBRDF = kd * pbrInputs.diffuseColor;

		// Cook-Torrance specular microfacet BRDF.
		vec3 specularBRDF = (F * D * G) / max(0.00001, 4.0 * cosLi * cosLo);

		// Total contribution for this light.
		return (diffuseBRDF + specularBRDF) * Lradiance * cosLi * u_light_color;
	}

	void main() {
        
		// get roughness and metalness
        float perceptualRoughness = texture2D(u_roughness_texture, v_coord).r;
        perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
        float alphaRoughness = perceptualRoughness * perceptualRoughness;
        float metallic = texture2D(u_metalness_texture, v_coord).r;
		metallic = max(c_MinMetalness, metallic);
		metallic = min(0.99, metallic);
        
		// get opacity and ambient oclusion
		float opacity = texture2D(u_opacity_texture, v_coord).r;
		float ao = texture2D(u_ao_texture, v_coord).r;
        
		// get emission
		vec4 emissiveColor = texture2D(u_emissive_texture, v_coord);

        vec3 baseColor = texture2D(u_albedo_texture, v_coord).rgb;
        vec3 f0 = vec3(0.04);
        vec3 diffuseColor = baseColor * (vec3(1.0) - f0);
        diffuseColor *= (1.0 - metallic);
        vec3 specularColor = mix(f0, baseColor, metallic);
        
        // Compute reflectance.
        float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
        // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
        // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
        float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
        vec3 specularEnvironmentR0 = specularColor.rgb;
        vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;
        
        vec3 v = normalize(v_wPosition - u_camera_position);    	// Vector from surface point to camera
        vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
        vec3 n = -normalize( perturbNormal( v_wNormal, v, v_coord, normal_map ) ); // normal at surface point
        vec3 l = normalize(v_wPosition - u_light_position);  			// Vector from surface point to light
		vec3 h = normalize(l+v);                                	// Half vector between both l and v
        vec3 reflection = normalize(reflect(-v, n));
		reflection.x *= -1.0;
        
        float NdotL = clamp(dot(n, l), 0.001, 1.0);
        float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
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
			emissiveColor,
            specularColor
        );
        
        // DIRECT LIGHTING
        vec3 DIRECT = getDirectLighting(pbrInputs, v, l, n);
        
        // IBL
        vec3 IBL = getIBLContribution(pbrInputs, n, reflection);
		
		// Apply ambient oclusion 
		if( u_enable_ao )
			IBL *= ao;
			   
        vec4 color = vec4(IBL + DIRECT, (u_hasAlpha) ? opacity : 1.0);

		// if(u_channel == 3.0)
		// 	color.rgb = DIRECT;
		if(u_channel == 3.0)
			color = texture2D(u_roughness_texture, v_coord);
		if(u_channel == 4.0)
			color = texture2D(u_metalness_texture, v_coord);
		if(u_channel == 5.0)
			color = vec4(vec3(ao), 1.0);
		if(u_channel == 6.0 && u_hasAlpha)
			color = texture2D(u_opacity_texture, v_coord);

		// Apply light from material (emissiveColor)
		if( u_isEmissive )
			// color.rgb += emissiveColor.rgb * (10.0 * ( sin(u_time*10.0 + v_wPosition.z )*0.5 + 1.0 ));
		 	color.rgb += emissiveColor.rgb * 10.0;

        gl_FragColor = color;
	}

\pbrMatrix.fs
    
    #extension GL_OES_standard_derivatives : enable
	precision highp float;

    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    varying vec2 v_coord;
    
    uniform float u_exposure;
	uniform float u_offset;
    uniform vec4 u_color;
    uniform vec4 background_color;
    uniform vec3 u_camera_position;

    uniform sampler2D u_brdf_texture;
    uniform samplerCube u_env_texture;
    uniform samplerCube u_env_1_texture;
    uniform samplerCube u_env_2_texture;
    uniform samplerCube u_env_3_texture;
    uniform samplerCube u_env_4_texture;
    uniform samplerCube u_env_5_texture;

	uniform float u_light_intensity;
    uniform vec3 u_light_color;
	uniform vec3 u_light_position;

	uniform float u_channel;
    uniform vec3 u_albedo;
    uniform float u_roughness;
    uniform float u_metalness;
    
	#import "ggx.inc"
	#import "prem.inc"
	#import "fresnel.inc"

	#define FDIELECTRIC 0.04
	#define PI 3.1415926535897932384626433832795
        
    const float c_MinRoughness = 0.01;
	const float c_MinMetalness = 0.01;
        
    struct PBRInfo
    {
        float NdotL;                  // cos angle between normal and light direction
        float NdotV;                  // cos angle between normal and view direction
        float NdotH;                  // cos angle between normal and half vector
        float LdotH;                  // cos angle between light direction and half vector
        float VdotH;                  // cos angle between view direction and half vector
        float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
        float metalness;              // metallic value at the surface
        float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
		vec3 F0;
        vec3 diffuseColor;            // color contribution from diffuse lighting
        vec3 specularColor;           // color contribution from specular lighting
    };

    vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
    {
        // Get values from brdf texture
		float x_brdf = pbrInputs.NdotV;
		float y_brdf = pbrInputs.perceptualRoughness;

        vec3 brdf = texture2D(u_brdf_texture, vec2(x_brdf, y_brdf)).rgb;
        
        // Sample diffuse irradiance at normal direction.
		vec3 diffuseLight = prem(n, 1.0);
		// Sample pre-filtered specular reflection environment
		vec3 specularLight = prem(reflection, pbrInputs.perceptualRoughness);
        
        vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
		
		// BIAS TO F0 not working properly!!!  (+brdf.y)
        vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x);// + brdf.y);
		vec3 color = diffuse + specular;

		if(u_channel == 1.0)
			color = diffuse;
		else if(u_channel == 2.0)
			color = specular;

        return color;
    }

	vec3 getDirectLighting(PBRInfo pbrInputs, vec3 Lo, vec3 Li, vec3 N)
	{
		vec3 Lradiance = vec3(u_light_intensity);

		// Half-vector between Li and Lo.
		vec3 Lh = normalize(Li + Lo);

		// Calculate angles between surface normal and various light vectors.
		float cosLi = pbrInputs.NdotL;
		float cosLo = pbrInputs.NdotV;
		float cosLh = max(0.0, dot(N, Lh));

		// vec3 F0 = mix(vec3(FDIELECTRIC), pbrInputs.diffuseColor, pbrInputs.metalness);

		// Calculate Fresnel term for direct lighting. 
		vec3 F = fresnelGDC(pbrInputs.specularColor, pbrInputs.NdotV);
		// Calculate normal distribution for specular BRDF.
		float D = ndfGGX(pbrInputs.alphaRoughness, pbrInputs.NdotV);
		// Calculate geometric attenuation for specular BRDF.
		float G = gaSchlickGGX(cosLi, cosLo, pbrInputs.perceptualRoughness);

		// Diffuse scattering happens due to light being refracted multiple times by a dielectric medium.
		// Metals on the other hand either reflect or absorb energy, so diffuse contribution is always zero.
		// To be energy conserving we must scale diffuse BRDF contribution based on Fresnel factor & metalness.
		vec3 kd = mix(vec3(1.0) - F, vec3(0.0), pbrInputs.metalness);

		// Lambert diffuse BRDF.
		// https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
		vec3 diffuseBRDF = kd * pbrInputs.diffuseColor;

		// Cook-Torrance specular microfacet BRDF.
		vec3 specularBRDF = (F * D * G) / max(0.00001, 4.0 * cosLi * cosLo);

		// Total contribution for this light.
		return (diffuseBRDF + specularBRDF) * Lradiance * cosLi * u_light_color;
	}

	void main() {

       	// get roughness and metalness
        float perceptualRoughness = u_roughness;
        perceptualRoughness = max(c_MinRoughness, perceptualRoughness);
		perceptualRoughness = min(0.99, perceptualRoughness);
        float alphaRoughness = perceptualRoughness * perceptualRoughness;
        float metallic = u_metalness;
		metallic = max(c_MinMetalness, metallic);
		metallic = min(0.99, metallic);
        
		vec3 baseColor = u_albedo;
		vec3 f0 = vec3(0.04);
		vec3 diffuseColor = mix(baseColor , vec3(0.0), metallic);
		vec3 specularColor = mix(f0, baseColor, metallic);
      	
        vec3 v = normalize(v_wPosition - u_camera_position);    // Vector from surface point to camera
        vec3 n = -normalize(v_wNormal);                          // normal at surface point
        vec3 l = -normalize(v_wPosition - u_light_position);  			// Vector from surface point to light
        vec3 h = normalize(l+v);                                // Half vector between both l and v
        vec3 reflection = normalize(reflect(-v, n));
		reflection.x *= -1.0;
        
		float NdotL = clamp(dot(-n, l), 0.001, 1.0);
        float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
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
            alphaRoughness,
			f0,
            diffuseColor,
            specularColor
        );

        // IBL
        vec3 color = getIBLContribution(pbrInputs, n, reflection);// + getDirectLighting(pbrInputs, v, l, n);

		if(u_channel == 3.0)
			color.rgb = vec3(perceptualRoughness);
		if(u_channel == 4.0)
			color.rgb = vec3(metallic);

		gl_FragColor = vec4(color, 1.0);
	}

//
// Get prefiltered environment map depending on the roughness
//

\prem.inc

	vec3 prem(vec3 R, float roughness) {
    
        float a = roughness * 5.0;

    	if(a < 1.0) return mix(textureCube(u_env_texture, R).rgb, textureCube(u_env_1_texture, R).rgb, a);
        if(a < 2.0) return mix(textureCube(u_env_1_texture, R).rgb, textureCube(u_env_2_texture, R).rgb, a - 1.0);
        if(a < 3.0) return mix(textureCube(u_env_2_texture, R).rgb, textureCube(u_env_3_texture, R).rgb, a - 2.0);
        if(a < 4.0) return mix(textureCube(u_env_3_texture, R).rgb, textureCube(u_env_4_texture, R).rgb, a - 3.0);
        if(a < 5.0) return mix(textureCube(u_env_4_texture, R).rgb, textureCube(u_env_5_texture, R).rgb, a - 4.0);

        return textureCube(u_env_5_texture, R).xyz;
    }

//
// Returns a sample based in fibonacci distribution
//

\fibonacci.inc

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


\importanceSampleGGX.inc

	// Given a sample in [0, 1] coordinates
	// output: vec3 containing 3d direction of the sample (??)
	vec3 importanceSampleGGX( vec2 Xi, float Roughness, vec3 N ) {

		float PI = 3.1415926535897932384626433832795;
	    float a = Roughness * Roughness;

	    float Phi = 2.0 * PI * Xi.x;

	    float CosTheta = sqrt( (1.0 - Xi.y) / ( 1.0 + (a * a - 1.0) * Xi.y ) );
	    float SinTheta = sqrt( 1.0 - CosTheta * CosTheta );

	    vec3 H;
	    H.x = SinTheta * cos( Phi );
	    H.y = SinTheta * sin( Phi );
	    H.z = CosTheta;

	    vec3 UpVector = abs(N.z) < 0.999999 ? vec3(0.0,0.0,1.0) : vec3(1.0,0.0,0.0);
	    vec3 TangentX = normalize( cross( UpVector, N ) );
	    vec3 TangentY = cross( N, TangentX );

	    // Tangent to world space
	    return normalize(TangentX * H.x + TangentY * H.y + N * H.z);
	}

\ggx.inc

	// ---------------------------------------------------------------
	// Geometry Term : Geometry masking / shadowing due to microfacets
	// ---------------------------------------------------------------
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float roughness, float NdotV, float NdotL){
		float k = (roughness )*(roughness ) / 2.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}

	// Schlick-GGX approximation of geometric attenuation function using Smith's method.
	float gaSchlickGGX(float cosLi, float cosLo, float roughness)
	{
		float r = roughness + 1.0;
		float k = (r * r) / 8.0; // Epic suggests using this roughness remapping for analytic lights.
		return GGX(cosLi, k) * GGX(cosLo, k);
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

\sgm.inc

	float PI = 3.1415926535897932384626433832795;

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
		vec4 emissiveColor;
        vec3 specularColor;           // color contribution from specular lighting
    };

	// The following equation models the Fresnel reflectance term of the spec equation (aka F())
    // Implementation of fresnel from [4], Equation 15
    vec3 specularReflection(PBRInfo pbrInputs)
    {
        return pbrInputs.reflectance0 + (pbrInputs.reflectance90 - pbrInputs.reflectance0) * pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
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

    // The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
    // Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
    // Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
    float microfacetDistribution(PBRInfo pbrInputs)
    {
        float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
        float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
        return roughnessSq / (PI * f * f);
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

\fxaa.inc

	//optimized version for mobile, where dependent 
	//texture reads can be a bottleneck
	vec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 resolution,
            vec2 v_rgbNW, vec2 v_rgbNE, 
            vec2 v_rgbSW, vec2 v_rgbSE, 
            vec2 v_rgbM) {
    vec4 color;
    mediump vec2 inverseVP = vec2(1.0 / resolution.x, 1.0 / resolution.y);
    vec3 rgbNW = texture2D(tex, v_rgbNW).xyz;
    vec3 rgbNE = texture2D(tex, v_rgbNE).xyz;
    vec3 rgbSW = texture2D(tex, v_rgbSW).xyz;
    vec3 rgbSE = texture2D(tex, v_rgbSE).xyz;
    vec4 texColor = texture2D(tex, v_rgbM);
    vec3 rgbM  = texColor.xyz;
    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lumaNW = dot(rgbNW, luma);
    float lumaNE = dot(rgbNE, luma);
    float lumaSW = dot(rgbSW, luma);
    float lumaSE = dot(rgbSE, luma);
    float lumaM  = dot(rgbM,  luma);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    
    mediump vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
    
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
                          (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
    
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
              max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
              dir * rcpDirMin)) * inverseVP;
    
    vec3 rgbA = 0.5 * (
        texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +
        texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz +
        texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);

    float lumaB = dot(rgbB, luma);
    if ((lumaB < lumaMin) || (lumaB > lumaMax))
        color = vec4(rgbA, texColor.a);
    else
        color = vec4(rgbB, texColor.a);
    return color;
}
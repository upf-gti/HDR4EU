/*
*   Alex Rodríguez
*   @jxarco 
*/

function PBR_Shader()
{
    if(this.constructor !== PBR_Shader)
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

Object.assign( PBR_Shader.prototype, {

    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup(debug) {

		if(debug)
			this.info();
		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = [
			'\t#extension GL_OES_standard_derivatives : enable',	
			'\tprecision highp float;\n'
		].join('\n');
		
		for(var i in this.defines) {
			this.vs_code += '\t#define ' + i + " " + this.defines[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + this.defines[i] + "\n";
		}

		for(var i in RM.shader_macros) {
			this.vs_code += '\t#define ' + i + " " + RM.shader_macros[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + RM.shader_macros[i] + "\n";
		}

		this.vs_code += PBR_Shader.VS_CODE;
		this.fs_code += PBR_Shader.FS_CODE;
		this.fs_code += PBR_Shader.FS_MAIN_CODE;
	}
} );

PBR_Shader.FS_MAIN_CODE = `

	void main() {
        
        PBRMat material;
		vec3 color;
		float alpha = 1.0;

        updateMaterial( material );
        updateVectors( material );
		do_lighting( material, color);

		if(u_hasAlpha)
			alpha = texture2D(u_opacity_texture, v_coord).r;

		if(u_isEmissive)
			 color += texture2D(u_emissive_texture, v_coord).rgb * u_emissiveScale;

		const int channels = 6; // 5: add one extra for limits
		  
		float x = (gl_FragCoord.x / u_viewport.z);
		float y = (gl_FragCoord.y / u_viewport.w);

		/*struct PBRMat
		{
			float linearRoughness;
			float roughness;
			float metallic;
			float f90;
			vec3 f0;
			vec3 diffuseColor;
			vec3 reflection;
			vec3 N;
			float NoV;
			float NoL;
			float NoH;
			float LoH;
			float clearCoat;
			float clearCoatRoughness;
			float clearCoatLinearRoughness;
		};		*/

		  
	

		if(u_show_layers)
		{

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
		}
        
        gl_FragColor = vec4(color, alpha);
    }
`;

PBR_Shader.VS_CODE = `
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
`;

PBR_Shader.FS_CODE = `
    
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
			metallic = texture2D(u_metalness_texture, v_coord).r;
		#endif

		vec3 baseColor = u_albedo;
		#ifdef HAS_ALBEDO_MAP
			baseColor = texture2D(u_albedo_texture, v_coord).rgb;
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
				roughness = texture2D(u_roughness_texture, v_coord).b;
			else
				roughness = texture2D(u_roughness_texture, v_coord).r;
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
		vec3 radiance = prem(material.reflection, material.linearRoughness * 0.5, u_rotation);
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
`;

// RM.registerShader( PBR_Shader, "pbr" );
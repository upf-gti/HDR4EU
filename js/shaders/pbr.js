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

	setup(console) {

		if(console)
			this.info();
		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = [
			'\t#extension GL_OES_standard_derivatives : enable',	
			'\tprecision highp float;\n'
		].join('\n');
		
		var defines_list = Object.assign(this.defines, RM.shader_macros);

		for(var i in defines_list) {
			this.vs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + defines_list[i] + "\n";
		}
		
		this.vs_code += PBR_Shader.VS_CODE;
		this.fs_code += PBR_Shader.FS_CODE;
		this.fs_code += PBR_Shader.FS_MAIN_CODE_FORWARD;
	}
} );

PBR_Shader.FS_MAIN_CODE_FORWARD = `

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

PBR_Shader.FS_MAIN_CODE_DEFERRED = `

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
	
		gl_FragData[0] = vec4(color, alpha);
		gl_FragData[1] = vec4((material.N * 0.5 + vec3(0.5) ), 1.0); 
		gl_FragData[2] = vec4(vec3(material.roughness), 1.0);
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
    uniform vec4 background_color;
	uniform vec4 u_viewport;
	uniform bool u_show_layers;

    uniform sampler2D u_brdf_texture;
	uniform sampler2D u_brdf_texture_multi;
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

    uniform float u_ibl_intensity;
    uniform float u_emissiveScale;
    uniform bool u_isEmissive;
    uniform bool u_hasAlpha;	
    uniform bool u_hasNormal;
    uniform bool u_hasAO;
    uniform bool u_enable_ao;
    uniform bool u_correctAlbedo;

	uniform float u_reflectance;
	uniform float u_clearCoat;
	uniform float u_clearCoatRoughness;

    struct PBRMat
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

    // Normal Distribution Function (NDC) using GGX Distribution
    float D_GGX (const in float NoH, const in float linearRoughness ) {
        float a2 = linearRoughness * linearRoughness;
        float f = (NoH * a2 - NoH) * NoH + 1.0;
        return a2 / (PI * f * f);
    }

    // Geometric shadowing using Smith Geometric Shadowing function
    // Extracting visibility function V(v, l, a)
    float V_SmithGGXCorrelated (const in float NoV, const in float NoL, const in float linearRoughness ) {
        float a2 = linearRoughness * linearRoughness;
        float GGXL = NoV * sqrt((-NoL * a2 + NoL) * NoL + a2);
        float GGXV = NoL * sqrt((-NoV * a2 + NoV) * NoL + a2);
        return 0.5 / (GGXV + GGXL);
    }

    // Approximation (Not correct 100% but has better performance)
    float V_SmithGGXCorrelatedFast (const in float NoV, const in float NoL, const in float linearRoughness ) {
        float a = linearRoughness;
        float GGXV = NoL * (NoV * (1.0 - a) + a);
        float GGXL = NoV * (NoL * (1.0 - a) + a);
        return 0.5 / (GGXV + GGXL);
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

	vec3 f0ClearCoatToSurface(const vec3 f0) {
		// Approximation of iorTof0(f0ToIor(f0), 1.5)
		// This assumes that the clear coat layer has an IOR of 1.5
		return clamp(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998, 0.0, 1.0);
	}

    void updateMaterial (inout PBRMat material) {
        float metallic = u_metalness;
        #ifdef HAS_METALNESS_MAP
            metallic = texture2D(u_metalness_texture, v_coord).r;
        #endif
        
        vec3 baseColor = u_albedo;
        #ifdef HAS_ALBEDO_MAP
            baseColor = texture2D(u_albedo_texture, v_coord).rgb;
        #endif

        // Transform Base Color to linear space
        if( u_correctAlbedo )
            baseColor = pow(baseColor, vec3(GAMMA));

        // Parameter Remapping (Base color)
        vec3 diffuseColor = (1.0 - metallic) * baseColor;

        // Parameter Remapping (f0)
        /* 
            Min reflectance - Water (2%) - Linear value is 0.35
            Default reflectance (4%) - Linear value is 0.5
            Max reflectance - Gemstones (16%) - Linear value is 1.0
        */
        
        float reflectance = u_reflectance; // 0.5 is the reflectance for default material
        
        // Compute f0 for dielectrics and metallic materials
        vec3 f0 = MAX_REFLECTANCE * reflectance * reflectance * (1.0 - metallic) + baseColor * metallic;

        // Parameter Remapping (roughness)
        float roughness = u_roughness;
        #ifdef HAS_ROUGHNESS_MAP
            roughness = texture2D(u_roughness_texture, v_coord).r;
        #endif
		roughness = max(roughness, MIN_ROUGHNESS);	

		// Clear coat lobe
		float clearCoat = u_clearCoat; // clear coat strengh
		float clearCoatRoughness = u_clearCoatRoughness;
		
		// Parameter remapping (clearCoatRoughness)
		clearCoatRoughness = mix(0.089, 0.6, clearCoatRoughness);
		float clearCoatLinearRoughness = clearCoatRoughness * clearCoatRoughness;

		// recompute f0 by first computing its IOR, then reconverting to f0
		// by using the correct interface
		//f0 = mix(f0, f0ClearCoatToSurface(f0), clearCoat);
		
		// remap roughness the base layer must be at least as rough
		// as the clear coat layer to take into account possible diffusion by the
		// top layer
		//roughness = max(roughness, clearCoatRoughness);
        float linearRoughness = roughness * roughness;

        material.roughness = roughness;
		material.linearRoughness = linearRoughness;
		material.clearCoat = clearCoat;
		material.clearCoatRoughness = clearCoatRoughness ;
		material.clearCoatLinearRoughness = clearCoatLinearRoughness;
		material.metallic = metallic;
        material.f0 = f0;
		material.diffuseColor = diffuseColor;
    }

    void updateVectors (inout PBRMat material) {
        vec3 v = normalize(v_wPosition - u_camera_position);
        vec3 n = normalize( v_wNormal );

        #ifdef HAS_NORMAL_MAP
            vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
            n = normalize( perturbNormal( v_wNormal, v, v_coord, normal_map ) );
        #endif

        vec3 l = -normalize(u_light_position - v_wPosition);
        vec3 h = normalize(v + l);

        material.reflection = normalize(reflect(-v, n));
		material.N = n;
        material.NoV = abs(dot(-n, v)) + 1e-5;
        material.NoL = clamp(dot(-n, l), 0.0, 1.0);
        material.NoH = clamp(dot(-n, h), 0.0, 1.0);
        material.LoH = clamp(dot(l, h), 0.0, 1.0);
    }

    vec3 specularBRDF( const in PBRMat material ) {
        float D = D_GGX( material.NoH, material.linearRoughness );
        float V = V_SmithGGXCorrelated( material.NoV, material.NoL, material.linearRoughness );
        vec3 F = F_Schlick( material.LoH, material.f0 );
        return (D * V) * F;
    }

	float specularClearCoat( const PBRMat material, inout float Fc) {
		
		float D = D_GGX( material.clearCoatLinearRoughness, material.NoH );
		float V = V_Kelemen( material.LoH );
		float F = F_Schlick( material.LoH, 0.04, 1.0 ) * material.clearCoat;
		
		Fc = F;

		return (D * V) * F;
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
    
        float a = roughness * 5.0;

		R = (rotationMatrix(vec3(0.0,1.0,0.0),rotation) * vec4(R,1.0)).xyz;

    	if(a < 1.0) return mix(textureCube(u_env_texture, R).rgb, textureCube(u_env_1_texture, R).rgb, a);
        if(a < 2.0) return mix(textureCube(u_env_1_texture, R).rgb, textureCube(u_env_2_texture, R).rgb, a - 1.0);
        if(a < 3.0) return mix(textureCube(u_env_2_texture, R).rgb, textureCube(u_env_3_texture, R).rgb, a - 2.0);
        if(a < 4.0) return mix(textureCube(u_env_3_texture, R).rgb, textureCube(u_env_4_texture, R).rgb, a - 3.0);
        if(a < 5.0) return mix(textureCube(u_env_4_texture, R).rgb, textureCube(u_env_5_texture, R).rgb, a - 4.0);

        return textureCube(u_env_5_texture, R).xyz;
    }

	// Fdez-Agüera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
	// Approximates multiscattering in order to preserve energy.
	// http://www.jcgt.org/published/0008/01/03/
	void BRDF_Specular_Multiscattering ( const in PBRMat material, inout vec3 singleScatter, inout vec3 multiScatter ) {
		
		float NoV = material.NoV;
		vec3 F = F_Schlick( NoV, material.f0 );
		vec2 brdf = texture2D( u_brdf_texture, vec2(NoV, material.linearRoughness) ).xy;
		vec3 FssEss = F * brdf.x + brdf.y;
		float Ess = brdf.x + brdf.y;
		float Ems = 1.0 - Ess;

		vec3 Favg = material.f0 + ( 1.0 - material.f0 ) * 0.047619; // 1/21
		vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
		singleScatter += FssEss;
		multiScatter += Fms * Ems;
	}

	// still no energy compensation
	void do_lighting(inout PBRMat material, inout vec3 color)
	{
		// Specular BRDF
        vec3 Fr = specularBRDF( material );
        // Diffuse BRDF
        vec3 Fd = material.diffuseColor * Fd_Lambert();
		// Combine
		vec3 direct = Fd + Fr;

		// Image based lighting 
		vec3 radiance = prem(material.reflection, material.roughness, u_rotation);
		vec3 irradiance = prem(material.reflection, 1.0, u_rotation);
		vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

		// update reflected color
		vec2 brdf = texture2D( u_brdf_texture, vec2(material.NoV, material.roughness) ).rg;
		vec3 F = F_Schlick( material.NoV, material.f0 );
		Fr = radiance * ( F * brdf.x + brdf.y);
		Fd = cosineWeightedIrradiance * material.diffuseColor;

		/*vec2 multi_DFG = texture2D(u_brdf_texture_multi, vec2(material.NoV, material.roughness) ).xy;
		float dfgx = max(1e-8, multi_DFG.x);
		float dfgy = max(1e-8, multi_DFG.y);
		vec3 spec = mix(vec3(dfgx), vec3(dfgy), material.f0);
		vec3 energyCompensation = 1.0 + spec * ((1.0 / dfgy) - 1.0);
		Fr *= (energyCompensation * 0.16);*/
		
		// Compute energy compensation
		float energyCompensation = 1.0;
		Fr *= energyCompensation;

		// Apply ambient oclusion 
		if(u_hasAO && u_enable_ao) {
			
			Fr *= texture2D(u_ao_texture, v_coord).r;
		}

		/*
			Clear coat lobe
		*/
		float Fc = F_Schlick( material.NoV, 0.04, 1.0) * material.clearCoat;
		float att = 1.0 - Fc;

		Fd *= att;
		Fr *= (att * att);
		Fr += prem(material.reflection, material.clearCoatRoughness, u_rotation) * Fc;
		
		vec3 indirect = Fd + Fr;

		vec3 lightScale = vec3(u_light_intensity);
		vec3 finalColor = indirect * u_ibl_intensity + direct * (material.NoL * u_light_color * lightScale);
    	color = finalColor;
	}
`;

RM.registerShader( PBR_Shader, "pbr" );
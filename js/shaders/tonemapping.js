/*
*   Alex Rodríguez
*   @jxarco 
*/

function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
}

Object.assign( Tonemapper.prototype, {
   
    apply(input, output) {

        var shader = this.shader;

        if(!shader) {
            shader = new GL.Shader(this.vs, this.fs);
            this.shader = shader;
        }
    
        if(!input)
        throw('Input texture missing');	
    
        // Join renderer uniforms with own uniforms
        var uniforms = Object.assign(renderer._uniforms, this.uniforms);
    
        output.drawTo(function(){
            input.bind(0);
            shader.toViewport( uniforms );
        });
    },

    injectCode(base_class) {

        var fs_code = `
            precision highp float;
            varying vec2 v_coord;
            uniform float u_exposure;
			uniform bool u_applyGamma;
            uniform float u_offset;
            uniform sampler2D u_color_texture;

            ` + base_class.Uniforms + `

            float C_GAMMA = 2.2;
            void main() {

                vec4 color = texture2D(u_color_texture, v_coord);
                
				/*if(u_applyGamma == true)
				{
					color = pow(color, vec4(C_GAMMA));
				}*/
				
				color *= u_exposure; //pb camera version for exposure
                color += vec4(u_offset);

                ` + base_class.Code + `
                
				#ifdef GAMMA
                    C_GAMMA = GAMMA;
                #endif

				/*if(u_applyGamma == true)
				{
					color = pow(color, vec4(1.0/C_GAMMA));
				}*/
                
                gl_FragColor = color;
            }
        `;

        return fs_code;

    },

    setParam(name, value) {

        this.params[name].value = value;
    }

} );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function No_Tonemapper()
{
    if(this.constructor !== No_Tonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
}

No_Tonemapper.Uniforms = '';    
No_Tonemapper.Code = '';

RM.registerTonemapper( No_Tonemapper, 'None' );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function ReinhardTonemapper()
{
    if(this.constructor !== ReinhardTonemapper)
        throw("Use new");

    this.defines = {};
	this.uniforms = {};
}

ReinhardTonemapper.Uniforms = `

`;    

ReinhardTonemapper.Code = `

    color = color / (color + vec4(1.0));

`;

RM.registerTonemapper( ReinhardTonemapper, 'Reinhard' );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function AtmosTonemapper()
{
    if(this.constructor !== AtmosTonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
    this.params = {
        'Scale': {
            value: 1,
            options: {
                min: 0.1,
                max: 10,
                step: 0.1
            }
        }
    };
}

AtmosTonemapper.Uniforms = `
    
    uniform float u_Scale;

`;    

AtmosTonemapper.Code = `

    color = 1.0 - exp(-1.0 * max(u_Scale, 0.01) * color);

`;

RM.registerTonemapper( AtmosTonemapper, 'Atmos');

/**
 * xxxxxxxxx LOGARITHMIC TONE MAPPER xxxxxxxxxxx
 */

function LogarithmicTonemapper()
{
    if(this.constructor !== LogarithmicTonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
	this.params = {
        'Brightness': {
            value: 0.22,
            options: {
                min: 0.01,
                max: 1.0,
                step: 0.01
            }
        }
    };
}

LogarithmicTonemapper.Uniforms = `

    uniform float u_maxLum;
	uniform float u_Brightness;

    float log10( float x ) {

        const float invLog10 = 0.43429448190325176;
        return (invLog10) * log(x);
    }
`;    

LogarithmicTonemapper.Code = `

    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_TM = log10(1.0+lum)/log10(1.0+u_maxLum) * u_Brightness;

    color.rgb *= lum_TM/lum;
`;

// RM.registerTonemapper( LogarithmicTonemapper, 'Logarithmic' );


/**
 * xxxxxxxxx EXPONENTIAL TONE MAPPER xxxxxxxxxxx
 */

function ExponentialTonemapper()
{
    if(this.constructor != ExponentialTonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
    this.params = {
        'Brightness': {
            value: 1,
            options: {
                min: 0.01,
                max: 1.0,
                step: 0.01
            }
        }
    };
}

ExponentialTonemapper.Uniforms = `
    uniform float u_logMean;
    uniform float u_Brightness;
`;

ExponentialTonemapper.Code = `

    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_TM = 1.0 - exp( -u_Brightness * lum/u_logMean );

    color.rgb *= lum_TM/lum;
`;

RM.registerTonemapper( ExponentialTonemapper, 'Exponential' );

/**
 * xxxxxx PHOTOGRAPHIC TONE REPRODUCTION xxxxxxxx
 */

function PTRTonemapper()
{
    if(this.constructor != PTRTonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
    this.params = {
        'Scaling': {
            value: 1,
            options: {
                min: 0.01,
                max: 1,
                step: 0.01
            }
        }
    };
}

PTRTonemapper.Uniforms = `
    
	uniform float u_logMean;
    uniform float u_maxLum;
    uniform float u_Scaling;

	const mat3 RGB_2_XYZ = (mat3(
		0.4124564, 0.3575761, 0.1804375,
		0.2126729, 0.7151522, 0.0721750,
		0.0193339, 0.1191920, 0.9503041
	));

	vec3 rgb_to_xyz(vec3 rgb) {
		return RGB_2_XYZ * rgb;
	}
`;

PTRTonemapper.Code = `

    float a = u_Scaling;
    float scale = a/u_logMean;

	// vec3 XYZ = rgb_to_xyz( color.rgb );

	// float Yw = XYZ.y;
	// float Y = (a / u_logMean) * Yw;
    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_TM = lum * scale;

	// float Lwhite = 1e6;
    // float Yd = (Y * (1.0 + (Y / (Lwhite * Lwhite)))) / (1.0 + Y) ;

    color.rgb *= lum_TM / lum;
	// color.rgb = pow( color.rgb / Yw, vec3(1.0)) * Yd;
`;

RM.registerTonemapper( PTRTonemapper, 'PTR' );

/**
 * xxxxxx Global tonemapper xxxxxxxx
 */

function GlobalTonemapper()
{
    if(this.constructor != GlobalTonemapper)
        throw("Use new");

	this.assembling = true;
    this.defines = {};
    this.uniforms = {};
    this.params = {
        'Key': {
            value: 0.18,
            options: {
                min: 0,
                max: 1,
                step: 0.01
            }
        },
		'Exposure': {
            value: 1,
            options: {
                min: 0,
                max: 5,
                step: 0.05
            }
        },
		'Saturation': {
            value: 1,
            options: {
                min: 0,
                max: 2,
                step: 0.05
            }
        }
    };
}

GlobalTonemapper.Uniforms = `

    uniform float u_Key;
	uniform float u_Ywhite;
	uniform float u_Exposure;
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
		float sat = clamp(u_Saturation, 0.001, 2.0);
		float key = clamp(u_Key, 0.001, 1.0);

		vec3 XYZ = rgb_to_xyz( RGB );

		float Yw = XYZ.y;
		float Y = (key / logAvgLum) * Yw;
		float Yd = (Y * (1.0 + (Y/(u_Ywhite * u_Ywhite)))) / (1.0 + Y);

		return pow( RGB / Yw, vec3(sat)) * Yd;
	}

`;

GlobalTonemapper.Code = `

	float logAvgLum = color.a;
	color = vec4(global( color.rgb, logAvgLum ), 1.0);
	color *= u_Exposure;
`;

RM.registerTonemapper( GlobalTonemapper, 'PTR_HDRI' );

/**
 * xxxxxx ExponentialHDRITonemapper xxxxxxxx
 */

function ExponentialHDRITonemapper()
{
    if(this.constructor != ExponentialHDRITonemapper)
        throw("Use new");

    this.defines = {};
    this.uniforms = {};
	this.assembling = true;
    this.params = {
        'Brightness': {
            value: 0.45,
            options: {
                min: 0.01,
                max: 1.0,
                step: 0.01
            }
        }
    };
}

ExponentialHDRITonemapper.Uniforms = `

    uniform float u_Brightness;

	float luminance( const vec3 color ){
		return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
	}

`;

ExponentialHDRITonemapper.Code = `

	float logAvgLum = color.a;
	
	 float lum = luminance(color.rgb);
    float lum_TM = 1.0 - exp( -u_Brightness * lum/logAvgLum );

    color.rgb *= lum_TM/lum;
`;

RM.registerTonemapper( ExponentialHDRITonemapper, 'ExponentialHDRI' );

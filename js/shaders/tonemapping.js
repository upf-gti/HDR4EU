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
            uniform float u_offset;
            uniform sampler2D u_color_texture;
            ` + base_class.Uniforms + `
            float C_GAMMA = 2.2;
            void main() {

                vec3 color = texture2D(u_color_texture, v_coord).rgb;
                //color *= pow( 2.0, u_exposure );
                // new pb camera version for exposure
                color *= u_exposure;
                color += vec3(u_offset);
                ` + base_class.Code + `
                #ifdef GAMMA
                    C_GAMMA = GAMMA;
                #endif
                color = pow(color, vec3(1.0/C_GAMMA));
                gl_FragColor = vec4(color, 1.0);
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

No_Tonemapper.prototype.injectCode = function(){

        var fs_code = `
            precision highp float;
            varying vec2 v_coord;
            uniform sampler2D u_color_texture;

            void main() {

                vec3 color = texture2D(u_color_texture, v_coord).rgb;
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        return fs_code;

}

No_Tonemapper.Uniforms = `

`;    

No_Tonemapper.Code = `
       

`;

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

    color = color / (color + vec3(1.0));

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
}

LogarithmicTonemapper.Uniforms = `

    uniform float u_maxLum;

    float log10( float x ) {

        const float invLog10 = 0.43429448190325176;
        return (invLog10) * log(x);
    }
`;    

LogarithmicTonemapper.Code = `

    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_TM = log10(1.0+lum)/log10(1.0+u_maxLum);

    color = color.rgb * lum_TM/lum;
`;

RM.registerTonemapper( LogarithmicTonemapper, 'Logarithmic' );


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
            value: 0.15,
            options: {
                min: 0.01,
                max: 1.5,
                step: 0.1
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

    color = color.rgb * lum_TM/lum;
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
        'GrayValue': {
            value: 0.18,
            options: {
                min: 0.01,
                max: 1.5,
                step: 0.01
            }
        }
    };
}

PTRTonemapper.Uniforms = `
    uniform float u_logMean;
    uniform float u_maxLum;
    uniform float u_GrayValue;
`;

PTRTonemapper.Code = `

    float a = u_GrayValue;
    float scale = a/u_logMean;

    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_scaled = lum * scale;

    float lum_TM = lum_scaled * (1.0 + lum_scaled/(u_maxLum * u_maxLum)) / (1.0 + lum_scaled) ;
    //float lum_TM = lum_scaled / (1.0+lum_scaled);

    color = color.rgb * lum_TM/lum;
`;

RM.registerTonemapper( PTRTonemapper, 'PTR' );


function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

WS.Tonemapper = Tonemapper;

Tonemapper.prototype.injectCode = function( base_class )
{
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

            color *= pow( 2.0, u_exposure );
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
}

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function None()
{
    if(this.constructor !== None)
        throw("Use new");

    this.uniforms = {};
}

None.Uniforms = `


`;    

None.Code = `
       

`;

CORE.registerTonemapper( None );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function Reinhard()
{
    if(this.constructor !== Reinhard)
        throw("Use new");

    this.uniforms = {};
}

Reinhard.Uniforms = `

`;    

Reinhard.Code = `

    color = color / (color + vec3(1.0));

`;

CORE.registerTonemapper( Reinhard );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function Atmos()
{
    if(this.constructor !== Atmos)
        throw("Use new");

    this.uniforms = {};
}

Atmos.Uniforms = `

`;    

Atmos.Code = `

    color = 1.0 - exp(-1.0 * color);

`;

CORE.registerTonemapper( Atmos );
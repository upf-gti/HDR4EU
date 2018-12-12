
/*
    this.params = {
        'param_name': {
            value: value,
            options: {
                min: min_value,
                max: max_value,
                step: step_value
            }
        }
*/

function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

WS.Tonemapper = Tonemapper;

Tonemapper.prototype.apply = function(input, output)
{
	var shader = this.shader;

	if(!shader)
	throw('Shader missing');	

    // Join renderer uniforms with own uniforms
	var uniforms = Object.assign(renderer._uniforms, this.uniforms);

	output.drawTo(function(){
		input.bind(0);
		shader.toViewport( uniforms );
	});
}

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

function No_Tonemapper()
{
    if(this.constructor !== No_Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

No_Tonemapper.Name = "None";

No_Tonemapper.Uniforms = `

`;    

No_Tonemapper.Code = `
       

`;

CORE.registerTonemapper( No_Tonemapper );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function ReinhardTonemapper()
{
    if(this.constructor !== ReinhardTonemapper)
        throw("Use new");

	this.uniforms = {};
}

ReinhardTonemapper.Name = "Reinhard";

ReinhardTonemapper.Uniforms = `

`;    

ReinhardTonemapper.Code = `

    color = color / (color + vec3(1.0));

`;

CORE.registerTonemapper( ReinhardTonemapper );

/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function AtmosTonemapper()
{
    if(this.constructor !== AtmosTonemapper)
        throw("Use new");

    this.uniforms = {};
    this.params = {
        'scale': {
            value: 1
        }
    };
}

AtmosTonemapper.Name = "Atmos";

AtmosTonemapper.Uniforms = `
    
    uniform float u_scale;

`;    

AtmosTonemapper.Code = `

    color = 1.0 - exp(-1.0 * max(u_scale, 0.01) * color);

`;

CORE.registerTonemapper( AtmosTonemapper );
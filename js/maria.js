
/**
 * xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

function LogTM()
{
    if(this.constructor !== LogTM)
        throw("Use new");

    this.uniforms = {
        //u_maxLum: renderer._uniforms['u_maxLum']
    };
}

LogTM.Uniforms = `
    uniform float u_maxLum;

    float log10( float x ) {

        const float invLog10 = 0.43429448190325176;
        return (invLog10) * log(x);
    }
`;    

LogTM.Code = `

    float lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float lum_TM = log10(1.0+lum)/log10(1.0+u_maxLum);

    color = color.rgb * lum_TM/lum;
`;

CORE.registerTonemapper( LogTM );
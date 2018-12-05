/**
* @class Tonemapper
* @constructor
*/
function Tonemapper( o )
{
    if(this.constructor !== Tonemapper)
        throw("Use new to create Tonemapper");

    this._ctor();
    if(o)
        this.configure( o );
}

Tonemapper.prototype._ctor = function()
{
    this.name = "";
    this.uniforms = "";
}

/**
 * Configure to a state from an object (used with serialize)
 * @method configure
 * @param {Object} o 
 */
Tonemapper.prototype.configure = function(o)
{
    //copy to attributes
    for(var i in o)
    {
        switch( i )
        {
            case "somecase": //special case
                continue;
        };

        //default
        var v = this[i];
        if(v === undefined)
            continue;

        if( v && v.constructor === Float32Array )
            v.set( o[i] );
        else 
            this[i] = o[i];
    }
}

/*Object.defineProperty(Tonemapper.prototype, '', {
    get: function() { return this._...; },
    set: function(v) { this._... = v; },
    enumerable: true
});*/
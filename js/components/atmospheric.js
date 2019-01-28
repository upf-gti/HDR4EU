/*
*   Alex Rodriguez
*   @jxarco 
*/

function AtmosphericScattering()
{
	if(this.constructor !== AtmosphericScattering)
		throw("Use new");

	this._sunPosition = 0.4;
    this._sunIntensity = 22;
    this._mieDirection = 0.76;
    this._originOffset = 0;
    this._mieCoeff = 21;
}

Object.defineProperty(AtmosphericScattering.prototype, 'sunPosition', {
    get: function() { return this._sunPosition; },
    set: function(v) { 
        this._sunPosition = v; 
        if(CORE)
            CORE.setUniform('SunPos', v);
    }, enumerable: true
});

Object.defineProperty(AtmosphericScattering.prototype, 'sunIntensity', {
    get: function() { return this._sunIntensity; },
    set: function(v) { 
        this._sunIntensity = v; 
        if(CORE)
            CORE.setUniform('SunIntensity', v);
    }, enumerable: true
});

Object.defineProperty(AtmosphericScattering.prototype, 'mieDirection', {
    get: function() { return this._mieDirection; },
    set: function(v) { 
        this._mieDirection = v; 
        if(CORE)
            CORE.setUniform('MieDirection', v);
    }, enumerable: true
});

Object.defineProperty(AtmosphericScattering.prototype, 'originOffset', {
    get: function() { return this._originOffset; },
    set: function(v) { 
        this._originOffset = v; 
        if(CORE)
            CORE.setUniform('originOffset', v);
    }, enumerable: true
});

Object.defineProperty(AtmosphericScattering.prototype, 'mieCoeff', {
    get: function() { return this._mieCoeff; },
    set: function(v) { 
        this._mieCoeff = v; 
        if(CORE)
            CORE.setUniform('MieCoeff', v);
    }, enumerable: true
});

Object.assign( AtmosphericScattering.prototype, {

	create(widgets, root) {
		
		var that = this;
	
		widgets.addTitle("Atmospheric scattering");
		widgets.addButton("Apply and update", '<i style="font-size: 16px;" class="material-icons">refresh</i>',{name_width: "40%", callback: function(v) {

			if(!gl.shaders['atmos'])
				LiteGUI.showMessage("Error: shader missing", {title: "App info"});
			else
			{
				var old_shader = CORE.cubemap.shader;
				CORE.cubemap.shader = "atmos";
				CORE.cubemapToTexture( function() { CORE.set(":atmos", {no_free_memory: true}) });
				CORE.cubemap.shader = old_shader;
			}
		}});
		widgets.addSeparator();
		widgets.widgets_per_row = 2;
		widgets.addNumber("Sun Position", this.sunPosition, {min: 0,step:0.01, callback: function(v){ that.sunPosition = v; }});
		widgets.addNumber("Mie Direction", this.mieDirection, {min:0, max:1,step:0.01,callback: function(v){ that.mieDirection = v; }});
		widgets.addNumber("Sun Intensity", this.sunIntensity, {min:0, max:50,step:0.05,callback: function(v){ that.sunIntensity = v; }});
		widgets.addNumber("Mie Coefficient", this.mieCoeff, {min:0, max:50,step:0.05,callback: function(v){ that.mieCoeff = v; }});
		widgets.widgets_per_row = 1;
		widgets.addNumber("Origin Offset", this.originOffset, {step: 50, min: 0,max: 7000, callback: function(v){ that.originOffset = v; }});
	}

} );

RM.registerComponent( AtmosphericScattering, 'Atmos');
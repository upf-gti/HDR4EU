/*
*   Alex Rodriguez
*   @jxarco 
*/

/*
MIN_APERTURE = 0.5f;
MAX_APERTURE = 64.0f;
MIN_SHUTTER_SPEED = 1.0f / 25000.0f;
MAX_SHUTTER_SPEED = 60.0f;
MIN_SENSITIVITY = 10.0f;
MAX_SENSITIVITY = 204800.0f;
*/

function SFX()
{
	if(this.constructor !== SFX)
		throw("Use new");
	
	this._exposure = 0;
	this._aperture = 0.5;
	this._shutter_speed = "1/125";
	this._sensitivity = 500;
	this._offset= 0;

	this.glow_enable = false;
	this.glow_intensity = 1;
	this.glow_threshold = 25;
	this.glow_iterations = 8;

	this.fxaa = false;
	this.tonemapping = "Reinhard";
	
	this.shs_values = [
		4,
		2,
		1,
		"1/2",
		"1/4",
		"1/15",
		"1/60",
		"1/125",
		"1/500",
		"1/1000",
		"1/2500",
	];

}

Object.defineProperty(SFX.prototype, 'exposure', {
	get: function() { return this._exposure; },
	set: function(v) { this._exposure = v; CORE.setUniform("exposure", v); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'offset', {
	get: function() { return this._offset; },
	set: function(v) { this._offset = v; CORE.setUniform("offset", v); },
	enumerable: true
});

Object.assign( SFX.prototype, {

	// Computes the camera's EV100 from exposure settings
	// aperture in f-stops
	// shutterSpeed in seconds
	// sensitivity in ISO
	exposureSettings() {
		
		 // EV100 = log2(N^2 / t) - log2(S / 100)
		 // EV100 = log2((N^2 / t) * (100 / S))

		var ss = this._shutter_speed;

		if(ss && ss.constructor === String) {

			var tks = ss.split('/');
			ss = parseInt(tks[0]) / parseInt(tks[1]);
		}

		var tmp1 = ( (this._aperture * this._aperture) / ss );
		var tmp2 = ( 100.0 / this._sensitivity );
			
		return tmp1 * tmp2;
	},

	updateExposure( value, setting ) {

		if(value && value == 0) 
		return;

		switch(setting) {
			case 01:
			this._aperture = value;
			break;
			case 02:
			this._shutter_speed = value;
			break;
			case 03:
			this._sensitivity = value;
			break;
		}

		if(value && value.constructor === String) {

			var tks = value.split('/');
			value = parseInt(tks[0]) / parseInt(tks[1]);
		}
		
		var ev100 = this.exposureSettings();
		//Computes the exposure normalization factor from the camera's EV100
		this.exposure = 1.0 / (ev100 * 1.2);
	},

	create(widgets, root) {

		this.updateExposure();
		var that = this;
	
		var iso_logo = '<img src="assets/iso.png" style="width:20px; padding:2px;">';
		var ev_logo = '<img src="assets/ev.png" style="width:20px; padding:2px;">';

		widgets.addSection("FX");
		widgets.addTitle("Frame exposition");
		widgets.addNumber("Aperture", this._aperture,{min:0.5,max:64,step: 0.5,callback: function(v) { that.updateExposure(v, 1); }});
		widgets.addCombo("Shutter speed", this._shutter_speed,{values:this.shs_values, callback: function(v) { that.updateExposure(v, 2); }});
		widgets.addNumber("Sensitivity"+iso_logo, this._sensitivity,{min:100,max:3200,step:100, callback: function(v) { that.updateExposure(v, 3); }});
		widgets.addSeparator();
		widgets.widgets_per_row = 2;
		widgets.addNumber("Offset", this.offset,{min:-0.5,max:0.5,step:0.01,callback: function(v) { that.offset = v; }});
		widgets.addCheckbox("FXAA",  this.fxaa, {name_width: '50%', callback: function(v){ that.fxaa = v; }});
		widgets.widgets_per_row = 1;

		if(CORE.browser !== 'safari')
		{
			widgets.addTitle("Tonemapping");

			var tonemapper_names = Object.keys(RM.tonemappers);
			var name = this.tonemapping;
			var tonemapper = RM.tonemappers[ name ];

			widgets.addCombo(null, name, {values: tonemapper_names, callback: function(v){
				that.tonemapping = v;
				window.last_scroll = root.content.getElementsByClassName("inspector")[0].scrollTop;
				gui.updateSidePanel( that._sidepanel, 'root' );
			}});
			
			if(tonemapper && tonemapper.params)
				for( let p in tonemapper.params ) // important let!!
				{
					var tm = tonemapper.params[p];
					var options = tm.options || {};

					CORE.setUniform(p, tm.value); 

					/*var element = document.createElement('i');
					element.className = "material-icons dragIcon";
					element.innerHTML = "panorama_fish_eye";
					pretitle: element.outerHTML */
					
					var toDrag = widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1,name_width: '50%', callback: function(v) {  
						CORE.setUniform(p, v); 
						tonemapper.setParam(p, v);
					}});

					toDrag.addEventListener("dragstart", function( e )
					{  
						e.dataTransfer.setData("type", "text");
						e.dataTransfer.setData("uniform", p);
						var img = new Image(); 
						img.src = 'https://webglstudio.org/latest/imgs/mini-icon-text.png'; 
						e.dataTransfer.setDragImage(img, 10, 10);
					});
					toDrag.setAttribute("draggable", true);
				}
			widgets.addSeparator();
		}
		
		//widgets.widgets_per_row = 1;
		widgets.addTitle("Glow");
		widgets.widgets_per_row = 2;
		widgets.addCheckbox("Enable", this.glow_enable, {width:"35%",callback: function(v) { that.glow_enable = v; } });
		widgets.addSlider("Intensity", this.glow_intensity, {width:"65%",min:1,max:2,step:0.1,callback: function(v) {  that.glow_intensity = v; }});
		widgets.addNumber("Threshold", this.glow_threshold, {min:0,max:500000,step:0.1,callback: function(v) { that.glow_threshold = v; }});
		widgets.addCombo("Iterations", this.glow_iterations, {values: [4, 8, 16],callback: function(v) { that.glow_iterations = v; }});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();
		widgets.addSeparator();
	}
} );

RM.registerComponent( SFX, 'ScreenFX');
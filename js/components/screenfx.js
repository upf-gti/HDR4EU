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
	this._aperture = 1.5;
	this._ec = 0.0;
	this._shutter_speed = "1/4";
	this._sensitivity = 100;
	this._offset= 0;
	this._camera_luminance = this.luminance();

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
		"1/8",
		"1/15",
		"1/30",
		"1/60",
		"1/125",
		"1/500",
		"1/1000",
		"1/2500",
	];

	this.mark = true;

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

	parseShutterSpeed( a ) {
		if(a && a.constructor === String) {

			var tks = a.split('/');
			a = parseInt(tks[0]) / parseInt(tks[1]);
		}

		return a;
	},

	// Computes the camera's EV100 from exposure settings
	// aperture in f-stops
	// shutterSpeed in seconds
	// sensitivity in ISO
	
	exposureSettings(N, t, s) {
		
		N = N || this._aperture;
		t = t || this._shutter_speed;
		s = s || this._sensitivity;

		 // EV100 = log2(N^2 / t) - log2(S / 100)
		 // EV100 = log2((N^2 / t) * (100 / S))

		var ss = this.parseShutterSpeed(t);
		return Math.log2(( N * N ) / ss) - Math.log2( s / 100.0 );
	},

	exposureSettings100() {
		
		var ss = this.parseShutterSpeed(this._shutter_speed);
		return Math.log2((this._aperture*this._aperture)/ss)
	},

	// get exposure compensation
	getEC() {
		
		if(this._ec > 0)
			return this.exposureSettings( this._aperture*Math.pow(2, this._ec) );
		else if(this._ec < 0)
			return this.exposureSettings( this._aperture/Math.pow(2, -1*this._ec) );
		return 0;
   },

	updateExposure( value, setting ) {

		if(value && value == 0) 
		return;

		switch(setting) {
			case -1:
			break;
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

		// in case its the shutter speed
		value = this.parseShutterSpeed(value);
		
		var ec = this.getEC();
		var ev = this.exposureSettings() - ec;
		//Computes the exposure normalization factor from the camera's EV
		this.exposure = 1.0 / (Math.pow(2.0, ev) * 1.2);

		this._camera_luminance = this.luminanceEV100(ev);
	},

	luminanceEV100 (ev100) {
		// With L the average scene luminance, S the sensitivity and K the
		// reflected-light meter calibration constant:
		//
		// EV = log2(L * S / K)
		// L = 2^EV100 * K / 100
		//
		// As in ev100FromLuminance(luminance), we use K = 12.5 to match common camera
		// manufacturers (Canon, Nikon and Sekonic):
		//
		// L = 2^EV100 * 12.5 / 100 = 2^EV100 * 0.125
		//
		// With log2(0.125) = -3 we have:
		//
		// L = 2^(EV100 - 3)
		//
		// Reference: https://en.wikipedia.org/wiki/Exposure_value
		return Math.pow(2.0, ev100 - 3.0);
	},


	luminance () {
		
		var sp = this._shutter_speed;

		if(sp && sp.constructor === String) {

			var tks = sp.split('/');
			sp = parseInt(tks[0]) / parseInt(tks[1]);
		}

		const e = (this._aperture * this._aperture) / sp * 100 / this._sensitivity;
		return e * 0.125;
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
		widgets.addNumber("Comp."+ev_logo, this._ec,{min:-5,max:5,step:1, callback: function(v) {  that._ec = v; that.updateExposure(1, -1); }});
		//widgets.addStringButton("Luminance", this._camera_luminance, {disabled: true, callback: function(){ gui.updateSidePanel(null, "root") }});
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
		
		//
		widgets.addTitle("Glow");
		widgets.widgets_per_row = 1;
		widgets.addCheckbox("Enable", this.glow_enable, {callback: function(v) { that.glow_enable = v; } });
		widgets.addSlider("Intensity", this.glow_intensity, {min:1,max:2,step:0.1,callback: function(v) {  that.glow_intensity = v; }});
		widgets.widgets_per_row = 2;
		widgets.addNumber("Threshold", this.glow_threshold, {min:0,max:500000,step:0.1,callback: function(v) { that.glow_threshold = v; }});
		widgets.addCombo("Iterations", this.glow_iterations, {values: [4, 8, 16],callback: function(v) { that.glow_iterations = v; }});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();
	}
} );

RM.registerComponent( SFX, 'ScreenFX');
/*
*   Alex Rodriguez
*   @jxarco 
*/

const MIN_APERTURE = 1.8;
const MAX_APERTURE = 32.0;
const MIN_SHUTTER_SPEED = 1/4000;
const MAX_SHUTTER_SPEED = 1/2;
const MIN_SENSITIVITY = 100.0;
const MAX_SENSITIVITY = 6400;

function SFX()
{
	if(this.constructor !== SFX)
		throw("Use new");
	
	this.enable = true;

	// physically based camera: manual exposure
	this.iso_rating_method = SFX.SO_SENSITIVITY;
	this.ec = 0;

	this._exposure = 0;
	this._aperture = 2.5;
	this._shutterSpeed = 1/30;
	this._iso = 300;
	this._middleGray = 0.18;
	// this._camera_luminance = this.luminance();
	
	// bloom effect	
	this.glow_enable = false;
	this.glow_intensity = 1;
	this.glow_threshold = 25;
	this.glow_iterations = 8;

	this._offset = 0;
	this._gamma = true;
	this.tonemapping = "Exponential";
	this.auto = true;
	this.mark = true;
	this.collapsed = false;

	this.fxaa = true;
	this.needs_update = false;
}

SFX.SB_SPEED = 01;
SFX.SO_SENSITIVITY = 02;

SFX.RATINGS = {
	"SBS": SFX.SB_SPEED,
	"SOS": SFX.SO_SENSITIVITY
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

Object.defineProperty(SFX.prototype, 'gamma', {
	get: function() { return this._gamma; },
	set: function(v) { this._gamma = v; CORE.setUniform("applyGamma", v); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'aperture', {
	get: function() { return this._aperture; },
	set: function(v) { this._aperture = v; this.updateProperties(); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'iso', {
	get: function() { return this._iso; },
	set: function(v) { this._iso = v; this.updateProperties(); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'shutterSpeed', {
	get: function() { return this._shutterSpeed; },
	set: function(v) { this._shutterSpeed = v; this.updateProperties(); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'middleGray', {
	get: function() { return this._middleGray; },
	set: function(v) { this._middleGray = v; this.updateProperties(); },
	enumerable: true
});

Object.assign( SFX.prototype, {

	toJSON() {
			
			var component = {};
			Object.assign(component, this);

			// remove widgets (cyclic)
			delete component.widgets;

			return component;
	},

	setup(){
		
		// this.updateProperties();
	},

	// Given the camera settings compute the current exposure value
	// ev100 = log2( L x 100 / K )
	// ev100 = log2( N*N*100 / t*S )
	computeEV(){
	
		var EV100 = Math.log2( (this._aperture * this._aperture) * 100 / (this._shutterSpeed * this._iso) );
		// console.log(EV100)

		return EV100;
	},

	// Using the light metering equation compute the target exposure value
	computeTargetEV(averageLuminance)
	{
		// K is a light meter calibration constant
		const K = 12.5;
		// K /= 2.0;

		return Math.log2(averageLuminance * 100.0 / K);
	},

	computeISO(tEV)
	{
		return (Math.sqrt(this._aperture) * 100.0) / (this._shutterSpeed * Math.pow(2.0, tEV));
	},

	getExposure( v )
	{
		var q = 0.65;

		/*
		*	Get an exposure using the Saturation-based Speed method.
			Saturation-based speed rates the ISO using the maximum photometric exposure (H_{sat}) that doesn't lead to pixel values greater than 255/255 
		*/
		if(v == SFX.SB_SPEED)
		{
			var l_max = ((7.8 / q) * Math.sqrt(this._aperture)) / (this._iso * this._shutterSpeed);
			return 1.0 / l_max;
		}
		/*
		* Get an exposure using the Standard Output Sensitivity method.
		* Accepts an additional parameter of the target middle grey.
		*/
		else{
			var l_avg = ((1.0 / q) * Math.sqrt(this._aperture)) / (this._iso * this._shutterSpeed);
			this.l_avg = l_avg;
			//CORE.setUniform("l_avg", l_avg);
			//CORE.setUniform('logMean', Math.log(l_avg));
			return this.middleGray / l_avg;
		}
	},

	updateProperties() {
	
		this.exposure = this.getExposure(this.iso_rating_method);

		if(this.needs_update)
		{
			this.needs_update = false;
			gui.updateSidePanel(null, 'root');
		}
	},

	setProgramAuto(averageLuminance, focalLength)
	{
		if(!this.auto)
			return;

		if(window.useFocalLength)
			focalLength = vec3.distance( camera.position, camera.target );
		else
			focalLength = 0.05;

		var targetEV = this.computeTargetEV(averageLuminance);

		// Start with the assumption that we want an aperture of 4.0
		this._aperture = 4.0;
	 
		// Start with the assumption that we want a shutter speed of 1/f
		this._shutterSpeed = 1.0 / (focalLength);
	 
		// Compute the resulting ISO if we left both shutter and aperture here
		this._iso = Math.clamp( this.computeISO(targetEV), MIN_SENSITIVITY, MAX_SENSITIVITY);
	 
		// Apply half the difference in EV to the aperture
		var evDiff = targetEV - this.computeEV();
		evDiff -= this.ec;
		this._aperture = Math.clamp(this._aperture * Math.pow(Math.sqrt(2.0), evDiff * 0.5), MIN_APERTURE, MAX_APERTURE);
	 
		// Apply the remaining difference to the shutter speed
		evDiff = targetEV - this.computeEV();
		evDiff -= this.ec;
		this._shutterSpeed = Math.clamp(this._shutterSpeed * Math.pow(2.0, -evDiff), MIN_SHUTTER_SPEED, MAX_SHUTTER_SPEED);

		this.updateProperties();
	},

	create(widgets, root) {

		this.updateProperties();
		var that = this;
		
		this.widgets = widgets;
		
		widgets.on_refresh = function(){
		
			var element = widgets.addSection("FX", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
			
			element.addEventListener("dragstart", function(e){
					e.dataTransfer.setData("type", "gui");
					e.dataTransfer.setData("component", "ScreenFX");
			});

			/*element.addEventListener("drop", function(e){
					console.log("sadsaqsdwqdw");
			});*/

			element.setAttribute("draggable", true);

			widgets.addCheckbox("Enable",  that.enable, {callback: function(v){ that.enable = v; }});
			widgets.addTitle("Scene Exposure");
			widgets.addCheckbox("Auto",  that.auto, {callback: function(v){ that.auto = v; that.needs_update = true; }});
			widgets.addSlider("Aperture", that.aperture, {min: MIN_APERTURE, max: MAX_APERTURE, step: 0.1, callback: function(v) { that.aperture = v; }});
			widgets.addSlider("Shutter speed", that.shutterSpeed, {min: MIN_SHUTTER_SPEED, max: MAX_SHUTTER_SPEED, step: 0.5, precision: 4,callback: function(v) { that.shutterSpeed = v; }});
			widgets.addSlider("ISO", that.iso, {min: MIN_SENSITIVITY, max: MAX_SENSITIVITY,step:100, precision: 0,callback: function(v) { that.iso = v; }});
			widgets.addSeparator();
			widgets.addInfo(null, "Advanced options");
			widgets.addCounter("EVcomp", that.ec,{min:-10,max:10, callback: function(v) { that.ec = v; }});
			widgets.addCombo( "ISO Rating", "SOS", { values: ["SBS", "SOS"], title:"Saturation-based speed or Standard output sensitivity",callback: function(v){ that.iso_rating_method = SFX.RATINGS[v]; that.updateProperties() } } );
			widgets.addSlider("Middle gray", that.middleGray, {min: 0, max: 1, step:0.01, callback: function(v) { that.middleGray = v; }});
			widgets.addSeparator();

			widgets.addTitle("Frame settings");
			widgets.widgets_per_row = 3;
			widgets.addNumber("Offset", that.offset,{name_width: '40%', min:-0.5,max:0.5,step:0.01,callback: function(v) { that.offset = v; }});
			widgets.addCheckbox("Gamma",  that.gamma, {callback: function(v){ that.gamma = v; }});
			widgets.addCheckbox("FXAA",  that.fxaa, {callback: function(v){ that.fxaa = v; }});
			widgets.widgets_per_row = 1;

			if(CORE.browser !== 'safari')
			{
				widgets.addTitle("Tonemapping");

				var tonemapper_names = Object.keys(RM.tonemappers).filter((v)=>!RM.tonemappers[v].assembling);
				var name = that.tonemapping;
				var tonemapper = RM.tonemappers[ name ];

				widgets.addCombo(null, name, {values: tonemapper_names, callback: function(v){
					that.tonemapping = v;
					var value = root.content.querySelectorAll(".inspector")[1].scrollTop;
					gui.updateSidePanel( null, 'root', {scroll: value});
				}});
				
				if(tonemapper && tonemapper.params)
					for( let p in tonemapper.params ) // important let!!
					{
						var tm = tonemapper.params[p];
						var options = tm.options || {};

						CORE.setUniform(p, tm.value); 
						
						widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1, callback: function(v) {  
							CORE.setUniform(p, v); 
							tonemapper.setParam(p, v);
						}});

						/*toDrag.addEventListener("dragstart", function( e )
						{  
							e.dataTransfer.setData("type", "text");
							e.dataTransfer.setData("uniform", p);
							var img = new Image(); 
							img.src = 'https://webglstudio.org/latest/imgs/mini-icon-text.png'; 
							e.dataTransfer.setDragImage(img, 10, 10);
						});
						toDrag.setAttribute("draggable", true);*/
					}
				widgets.addSeparator();
			}
			
			//
			widgets.addTitle("Glow");
			widgets.widgets_per_row = 1;
			widgets.addCheckbox("Enable", that.glow_enable, {callback: function(v) { that.glow_enable = v; } });
			widgets.addSlider("Intensity", that.glow_intensity, {min:1,max:2,step:0.1,callback: function(v) {  that.glow_intensity = v; }});
			widgets.widgets_per_row = 2;
			widgets.addNumber("Threshold", that.glow_threshold, {min:0,max:500000,step:0.1,callback: function(v) { that.glow_threshold = v; }});
			widgets.addCombo("Iterations", that.glow_iterations, {values: [4, 8, 16],callback: function(v) { that.glow_iterations = v; }});
			widgets.widgets_per_row = 1;
			widgets.addSeparator();
		}

		widgets.refresh();
	}
} );

RM.registerComponent( SFX, 'ScreenFX');
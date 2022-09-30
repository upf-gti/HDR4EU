/*
*   Alex Rodriguez
*   @jxarco 
*/

// LGraphHistogram at webglstudio.org graph system (@jagenjo)

function ChromaKey(node)
{
	this.node = node;
	this.mark = true;
	this.collapsed = false;
	this.nodeComponent = true;

	this._isVideo = false;

	this._enabled = true;
	this._balance = 0;
	this._key_color = [73/255, 173/255, 74/255, 1.0];
	this._fake_bounce = [1/255, 5/255, 5/255, 1.0];
	this._luminance_mask_power = 0.18;
	this._despill_amount = 0.4;
	this._despill_threshold = 0;
	this._enable_despill = true;
	this._applyShading = false;
	this._chroma_ibl_intensity = 2;
}

ChromaKey.icon = "https://webglstudio.org/users/arodriguez/imgs/mini-chroma.png";

Object.assign( ChromaKey.prototype, {

	setup() {
		
		console.log(RM);

		this.node.old_shader = this.node.shader;
		this.node.shader = "chroma";

		this.node.textures["chroma"] = "white";
		this.node.textures["normal"] = "white";

		Object.assign(this.node.uniforms, {
			
			u_enable_chroma: this._enabled,
			u_balance: this._balance,
			u_key_color: this._key_color,
			u_fake_bounce: this._fake_bounce,
			u_luminance_mask_power: this._luminance_mask_power,
			u_despill_amount: this._despill_amount,
			u_despill_threshold: this._despill_threshold,
			u_enable_despill: this._enable_despill,
			u_applyShading: this._applyShading,
			u_chroma_ibl_intensity: this._chroma_ibl_intensity
		});
	},

	create(widgets, no_section) {
		
		var that = this;

		if(!no_section || no_section.constructor === LiteGUI.Panel)
		{
			var element = widgets.addSection("Chroma Key", {collapsed: that.collapsed, callback: function(no_collapsed){
					that.collapsed = !no_collapsed;
				}});
		
			element.addEventListener("dragstart", function(e){
					e.dataTransfer.setData("type", "gui");
					e.dataTransfer.setData("component", "ChromaKey");
			});
	
			element.setAttribute("draggable", true);
		}

		widgets.widgets_per_row = 2;

		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ 
			that.enabled = v; 
		} });
	
		widgets.addCheckbox("Shading", this.applyShading, { callback: function(v){ 
			that.applyShading = v; 
		} });
		widgets.widgets_per_row = 1;

		widgets.addSlider("IBL intensity", this.chroma_ibl_intensity, { min: 0, step: 0.01, max: 10,callback: function(v){ that.chroma_ibl_intensity = v; } });
		widgets.addSeparator();

		widgets.addTexture("Image", node.textures["chroma"], {name: "chroma", node: node, callback: function(name, tex){

			that.setChroma(tex);
		}});
		widgets.addTexture("Normal", node.textures["normal"], {name: "normal", node: node, callback: function(name, tex){
			
		}});

		widgets.addButton(null, "Edit Normal", {callback: function(){

			gui.showChromaTools(that.node);

		}});
		
		widgets.addSeparator();

		widgets.addColor("Key color", this.key_color, { callback: function(v){ that.key_color = v; } });
		widgets.addColor("Fake bounce", this.fake_bounce, { callback: function(v){ that.fake_bounce = v; } });
		widgets.addSlider("Balance", this.balance, { callback: function(v){ that.balance = v; } });
		widgets.addSlider("Luminance mask", this.luminance_mask_power, { callback: function(v){ that.luminance_mask_power = v; } });
		widgets.addTitle("Despill");
		widgets.addCheckbox("Enable", this.enable_despill, { callback: function(v){ that.enable_despill = v; } });
		widgets.widgets_per_row = 2;
		widgets.addNumber("Amount", this.despill_amount, { callback: function(v){ that.despill_amount = v; } });
		widgets.addNumber("Threshold", this.despill_threshold, { callback: function(v){ that.despill_threshold = v; } });
		widgets.widgets_per_row = 1;
		widgets.addTitle("Video");
		widgets.addCheckbox("Enable", this._isVideo, { callback: function(v){ 
			that._isVideo = v; 
		} });

		widgets.addSeparator();

		var add_component_node = widgets.addButton(null, "&#10008; Delete component", {callback: function(){
			
			if(that.node.old_shader)
				that.node.shader = that.node.old_shader;

			delete that.node.components["ChromaKey"];
			gui.updateSidePanel(null, that.node.name);

		}});
		add_component_node.querySelector("button").classList.add("section-button");
	},

	preRender() {
		
		// update video normals
		if(!this._isVideo || !this.normal_settings)
		return;

		// console.log(this.normal_settings);
		console.log( GFX.generate2DNormals(this.node.textures["chroma"], this.node, this.normal_settings) );
	},

	setChroma(tex) {

		var node = this.node;
		var chroma_texture = tex;
		
		if(tex.constructor === String) {
		
			node.textures["chroma"] = tex;
			chroma_texture = gl.textures[tex];
		}
			
		var w = chroma_texture.width,
			h = chroma_texture.height;

		var aspect = w/h;

		node.scaling = 1;
		node._scale[0] *= aspect;
		node.updateMatrices();
	}
});

Object.defineProperty(ChromaKey.prototype, 'enabled', {
    get: function() { return this._enabled; },
    set: function(v) { 
        this._enabled = v;
        if(node)
            node.uniforms["u_enable_chroma"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'applyShading', {
    get: function() { return this._applyShading; },
    set: function(v) { 
        this._applyShading = v;
        if(node)
            node.uniforms["u_applyShading"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'chroma_ibl_intensity', {
    get: function() { return this._chroma_ibl_intensity; },
    set: function(v) { 
        this._chroma_ibl_intensity = v;
        if(node)
            node.uniforms["u_chroma_ibl_intensity"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'balance', {
    get: function() { return this._balance; },
    set: function(v) { 
        this._balance = v;
        if(node)
            node.uniforms["u_balance"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'key_color', {
    get: function() { return this._key_color; },
    set: function(v) { 
        this._key_color = v;
        if(node)
            node.uniforms["u_key_color"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'fake_bounce', {
    get: function() { return this._fake_bounce; },
    set: function(v) { 
        this._fake_bounce = v;
        if(node)
            node.uniforms["u_fake_bounce"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'luminance_mask_power', {
    get: function() { return this._luminance_mask_power; },
    set: function(v) { 
        this._luminance_mask_power = v;
        if(node)
            node.uniforms["u_luminance_mask_power"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'despill_amount', {
    get: function() { return this._despill_amount; },
    set: function(v) { 
        this._despill_amount = v;
        if(node)
            node.uniforms["u_despill_amount"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'despill_threshold', {
    get: function() { return this._despill_threshold; },
    set: function(v) { 
        this._despill_threshold = v;
        if(node)
            node.uniforms["u_despill_threshold"] = v;
    }, enumerable: true
});

Object.defineProperty(ChromaKey.prototype, 'enable_despill', {
    get: function() { return this._enable_despill; },
    set: function(v) { 
        this._enable_despill = v;
        if(node)
            node.uniforms["u_enable_despill"] = v;
    }, enumerable: true
});

RM.registerNodeComponent( ChromaKey, 'ChromaKey');

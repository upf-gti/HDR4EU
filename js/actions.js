
function getContextMenuActions()
{
	var shaded_models = [];
	var scenes = RM.scenes;
	var RenderComponent = RM.get("Render");

	// OJO CON ESTE
	for(var s in scenes)
		shaded_models.push( {title: scenes[s].name, callback: function(v) {
			CORE.parse( v.title );
			gui.updateSidePanel(null, v.title );
		}});

	var actions = [
	{
		title: "Model", //text to show
		has_submenu: true,
		submenu: {
			options: shaded_models
		}
	},
	{
		title: "Primitive", //text to show
		has_submenu: true,
		submenu: {
			options: 
			[{
				title: "Sphere",
				callback: function() { CORE.addPrimitive("sphere") }
			},{
				title: "Plane",
				callback: function() { CORE.addPrimitive("plane") }
			},{
				title: "Cube",
				callback: function() { CORE.addPrimitive("cube") }
			}]
		}
		
	},
	{
		title: "Component", //text to show
		has_submenu: true,
		submenu: {
			options: 
			[{
				title: "Histogram",
				callback: function() { RM.registerComponent( Histogram, 'Histogram'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
			},
			{
				title: "Atmos Scattering",
				callback: function() { RM.registerComponent( AtmosphericScattering, 'Atmos'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
			},
			{
				title: "Texture Tools",
				callback: function() { RM.registerComponent( TextureTools, 'TextureTools'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
			},
			{
				title: "Irradiance Cache",
				callback: function() { RM.registerComponent( IrradianceCache, 'IrradianceCache'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
			}]
		}
	},
	{
		title: "Light", //text to show
		callback: function() { CORE.addLight() }
	},
	,
	{
		title: "Render mode", //text to show
		has_submenu: true,
		submenu: {
			options: 
			[{
				title: "FORWARD",
				callback: function() { if(RenderComponent) RenderComponent.render_mode = RM.FORWARD; gui.updateSidePanel(null, 'root');}
			},{
				title: "DEFERRED",
				callback: function() { if(RenderComponent) RenderComponent.render_mode = RM.DEFERRED; gui.updateSidePanel(null, 'root');}
			}]
		}
	}
	];

	return actions;
}


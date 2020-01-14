/*
*   Alex Rodriguez
*   @jxarco 
*/

// Target - webglstudio.org at litescene.js (@jagenjo)

function Target(node)
{
	this.node = node;
	this.mark = true;
	this.collapsed = false;
	this.nodeComponent = true;

	this.enabled = true;
	this.cylindrical = false;
	this.up = Target.POSY;
	this.front = Target.NEGZ;
	this.face_camera = false;
	this.target_node = "";
	
	this._global_position = vec3.create();
	this._target_position = vec3.create();
}

Target.POSX = 1;
Target.NEGX = 2;
Target.POSY = 3;
Target.NEGY = 4;
Target.POSZ = 5;
Target.NEGZ = 6;

Target.icon = "https://webglstudio.org/users/arodriguez/imgs/mini-target.png";

Object.assign( Target.prototype, {

	setup() {
		
		console.log(RM);
	},

	create(widgets, root) {
		
		var that = this;

		var element = widgets.addSection("Target", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
	

		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ 
			that.enabled = v; 
		} });

		widgets.addSeparator();
		widgets.addCheckbox("Face camera", this.face_camera, { callback: function(v){ that.face_camera = v; } });
		widgets.addString("Node", this.target_node, { callback: function(v){ that.target_node = v; } });
	},

	preRender() {
		
		if(!this.enabled)
		return;

		var eye = null;
		var target_position = null;
		var up = null;
		var position = this.node.getGlobalPosition();

		switch( this.up )
		{
			case Target.NEGX: up = vec3.fromValues(-1,0,0); break;
			case Target.POSX: up = vec3.fromValues(1,0,0); break;
			case Target.NEGZ: up = vec3.fromValues(0,0,-1); break;
			case Target.POSZ: up = vec3.fromValues(0,0,1); break;
			case Target.NEGY: up = vec3.fromValues(0,-1,0); break;
			case Target.POSY: 
			default:
				up = vec3.fromValues(0,1,0);
		}

		if( this.target_node )
		{
			var node = CORE.getByName(this.target_node);
			if(!node || node == this.node)
				return;
			target_position = node.getGlobalPosition();
		}
		else if( this.face_camera )
		{
			var camera = CORE.controller._camera;
			if(!camera)
				return;
			target_position = camera.position;
		}
		else
			return;

		if( this.cylindrical )
		{
			target_position[1] = position[1];
		}

		orientTo( this.node, position, target_position, false, up);

		switch( this.front )
		{
			case Target.POSY: quat.rotateX( node.rotation, node.rotation, Math.PI * -0.5 );	break;
			case Target.NEGY: quat.rotateX( node.rotation, node.rotation, Math.PI * 0.5 );	break;
			case Target.POSX: quat.rotateY( node.rotation, node.rotation, Math.PI * 0.5 );	break;
			case Target.NEGX: quat.rotateY( node.rotation, node.rotation, Math.PI * -0.5 );	break;
			case Target.POSZ: quat.rotateY( node.rotation, node.rotation, Math.PI );	break;
			case Target.NEGZ:
			default:
		}
		
	}
});

RM.registerNodeComponent( Target, 'Target');
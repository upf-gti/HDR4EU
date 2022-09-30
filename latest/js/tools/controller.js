/*
*   author: Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible for camera movement and event bindings
* @class CameraController
* @constructor
*/

function CameraController(context, o)
{
    if(this.constructor !== CameraController)
        throw("Use new to create CameraController");
    this._ctor();
    if(o)
        this.configure(o);
}

RD.Camera._Types = ["PERSPECTIVE", "ORTHOGRAPHIC"];

CameraController.prototype._ctor = function()
{
    this._fov = 45;
    this._near = 0.1;
    this._far = 100;
    this._aspect = gl.canvas.width / gl.canvas.height;

    this._eye = [-1.5, 2, 6];
    this._target = [0, 0, 0];
    this._up = [0, 1, 0];
    
    this.camera = new RD.Camera();
    this.camera.perspective( this._fov, this._aspect, this._near, this._far);
    this.camera.lookAt( this._eye, this._target, this._up );

    this.smooth = true;
    this.collapsed = false;
}

CameraController.prototype.reset = function()
{
    this._fov = 45;
    this._near = 1;
    this._far = 100;
    this._aspect = gl.canvas.width / gl.canvas.height;
    
     this._eye = [-1.5, 2, 6];
    this._target = [0, 0, 0];
    this._up = [0, 1, 0];
    
    this.camera.perspective( this._fov, this._aspect, this._near, this._far);
    this.camera.lookAt( this._eye, this._target, this._up );

    // events
    this._mouse_speed = 0.25;
	this._keys = {};

    gui.updateSidePanel(null, 'root');
}

CameraController.prototype.configure = function(o)
{
    o = o || {};

	this._fov = o.fov || this._fov;
	this._aspect = gl.canvas.width / gl.canvas.height;
	this._near = o.near || this._near;
	this._far = o.far || this._far;
	this._eye = o.eye || this._eye;
	this._target = o.target || this._target;
	this._up = o.up || this._up;

    this.camera.perspective( this._fov, this._aspect , this._near, this._far);
    this.camera.lookAt( this._eye, this._target, this._up );
}

/**
 * Performs camera lookAt
 * @method lookAt
 * @param {vec3} eye
 * @param {vec3} center
 * @param {vec3} up
 */
CameraController.prototype.lookAt = function(eye, center, up)
{
    this.camera.lookAt( eye, center, up );
}

/**
 * Returns CameraController's camera position
 * @method getCameraPosition
 */
CameraController.prototype.getCameraPosition = function()
{
    return this.camera.position;
}

CameraController.prototype.onNodeLoaded = function(node, newEye, custom_scale)
{
    custom_scale = custom_scale || 100;
    var bb = gl.meshes[node.mesh].getBoundingBox();
    var center = BBox.getCenter(bb);
    var scale = node.scaling[0];

    if(node.parentNode)
        scale *= node.parentNode.scaling[0]; 
    var radius = BBox.getRadius(bb) * scale;
    radius = radius || 1;
    
    if(CORE)
        CORE.selected_radius = radius;

    var globalMat = node.getGlobalMatrix();
    var result = vec3.create();
    vec3.transformMat4( result, center, globalMat );

    this.camera.lookAt(newEye ? newEye : [ 0, radius * 0.5, radius * 3 ], result, RD.UP);
    window.destination_eye = camera.position;

    // update near depending on the BB radius
    // this.camera.near = radius * 0.45;
    this.camera.far = radius * custom_scale;
}

// editor.js at webglstudio @javiagenjo
CameraController.prototype.changeDistance = function(dt)
{
    var camera = this.camera;

    if(window.destination_eye === undefined)
        window.destination_eye = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);

    var center = camera.target;
    var dist = vec3.sub( vec3.create(), this.smooth ? window.destination_eye : camera.position, center );
    vec3.scale( dist, dist, dt );

    if(camera.type == RD.Camera.ORTHOGRAPHIC)
        camera.frustum_size = vec3.length(dist);

    var new_eye = vec3.create();

    if(this.smooth)
        vec3.add(window.destination_eye, dist, center);
    else
        vec3.add(camera.position, dist, center);
}

CameraController.prototype.orbit = function(yaw, pitch, guided)
{
    var camera = this.camera;
    var problem_angle = vec3.dot( camera.getFront(), camera.up );

    var center = camera._target;
    var right = camera.getLocalVector(RD.RIGHT);
    var up = camera.up;

    if(window.destination_eye === undefined)
    window.destination_eye = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);

    var dist = vec3.sub( vec3.create(), this.smooth ? window.destination_eye : camera.position, center );

    if( !guided ) {
        // yaw
        var R = quat.fromAxisAngle( up, -yaw );
        vec3.transformQuat( dist, dist, R );
    
        if( !(problem_angle > 0.99 && pitch > 0 || problem_angle < -0.99 && pitch < 0)) 
            quat.setAxisAngle( R, right, pitch );
    
        vec3.transformQuat(dist, dist, R );

        if(this.smooth)
            vec3.add(window.destination_eye, dist, center);
        else
            vec3.add(camera.position, dist, center);
    }

    //vec3.add(window.destination_eye, dist, center);
    camera._must_update_matrix = true;
}

CameraController.prototype.panning = function( e, mouseCollision, localSpace )
{
    const camera = this.camera;

    const center = camera.getFront();
    const collision = vec3.create();

    Tools.testPerpendicularPlane( e.canvasx, gl.canvas.height - e.canvasy, center, collision, this.camera );
    const delta = vec3.sub( vec3.create(), mouseCollision, collision);

    console.log(delta);

    // Movement

    camera.updateMatrices(true);

    var eye = camera.getEye();

    if( localSpace )
        delta = camera.getLocalVector(delta);

    var newEye;
    var newTarget;

    newEye = camera.getEye();
    newTarget = camera.target;

    vec3.add( newEye, delta, eye );
    vec3.add( newTarget, delta, center );

    if( !this.smooth_camera ) {
        camera.eye = newEye;
        camera.target = newTarget;
    }
    else
    {
    
    }
}

CameraController.prototype.setLSCamera = function( camera )
{
    camera.updateMatrices();
    vec3.copy( LS.Draw.camera_position, camera.position );	
    LS.Draw.view_matrix.set( camera._view_matrix );
    LS.Draw.projection_matrix.set( camera._projection_matrix );
    LS.Draw.viewprojection_matrix.set( camera._viewprojection_matrix );
    LS.Draw.uniforms.u_perspective = gl.viewport_data[3] * LS.Draw.projection_matrix[5];
}

Object.defineProperty(CameraController.prototype, 'near', {
    get: function() { return this._near; },
    set: function(v) { 
		this._near = v;
		CORE.setUniform("near", v);
		this.camera.near = v;
	},
    enumerable: true //avoid problems
});

Object.defineProperty(CameraController.prototype, 'far', {
    get: function() { return this._far; },
    set: function(v) { 
		this._far = v; 
		CORE.setUniform("far", v);
		this.camera.far = v;
	},
    enumerable: true //avoid problems
});
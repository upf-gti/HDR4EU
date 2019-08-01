//Scale and Offset
function DragAndScale( element )
{
	this.offset = new Float32Array([0,0]);
	this.scale = 1;
	this.min_scale = 0.2;
	this.max_scale = 8;
	this.onredraw = null;
	this._keys = {};

	this.last_mouse = new Float32Array(2);
        
	if(gl)
	{
		this.element = gl.canvas;
	}
}

DragAndScale.prototype.bindEvents = function()
{
    var ctx = gl;
    if(!ctx)
        throw('no WebGLRenderingContext');

	var keys = this._keys;
	var canvas = gl.canvas;
	var rect = canvas.getBoundingClientRect();
	var that = this;

    ctx.captureKeys(true);
    ctx.onkeydown = function(e)
    {
		keys[e.keyCode] = true;

        if(e.keyCode === 82) // R
            CORE.reloadShaders(); 
		if(e.keyCode === 49)
			$("#maintab").click();
		if(e.keyCode === 50)
			$("#assemblytab").click();
		if(e.keyCode === 27)
			HDRI.resetCrop();
    }
	ctx.onkeyup = function(e)
    {
		keys[e.keyCode] = false;
    }
    ctx.captureMouse(true);

    ctx.onmousemove = function(e)
    {
		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		e.canvasx = x;
		e.canvasy = y;

        if(e.shiftKey)
				HDRI.shifting = true;
			else
				HDRI.shifting = false;

		var deltax = x - that.last_mouse[0];
		var deltay = y - that.last_mouse[1];

		if( that.dragging ){

			var pos = HDRI.toOffset(x, y);
			var spot = HDRI.toOffset(x, y, true);

			if(e.shiftKey){

				if(!HDRI.originCaptured) {
					HDRI.cropOrigin = pos;
					HDRI.originCaptured = true;
				}

				HDRI.cropSize = numeric.sub(pos, HDRI.cropOrigin);
			}
			else{

				var pixelx = pos[0];
				var pixely = pos[1];

				/*var limit = pixelx >= 0 && pixelx < HDRI.texture.width && pixely >= 0 && pixely < HDRI.texture.height;
				if(!limit && HDRI.resizing)
					return;*/
				
				if(HDRI.currentSpot > 0)
				{
					HDRI.resizeSection(HDRI.currentSpot, deltax / that.scale, deltay / that.scale);
				}
				else
				{
					var whichSpot = HDRI.inSpot(pos[0], pos[1], spot);
					HDRI.currentSpot = whichSpot;

					if(whichSpot < 0)
						that.mouseDrag( deltax, deltay );
					else
						HDRI.resizeSection(whichSpot, deltax / that.scale, deltay / that.scale);
				}
				
			}
				
		}

		that.last_mouse[0] = x;
		that.last_mouse[1] = y;

		e.preventDefault();
		e.stopPropagation();
		return false;
    }

    ctx.captureTouch(true);

    ctx.onmousewheel = function(e)
    {
		e.eventType = "mousewheel";
		if(e.type == "wheel")
			e.wheel = -e.deltaY;
		else
			e.wheel = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);

		//from stack overflow
		e.delta = e.wheelDelta ? e.wheelDelta/40 : e.deltaY ? -e.deltaY/3 : 0;
		
		that.changeDeltaScale(1.0 + e.delta * 0.05);

		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		e.canvasx = x;
		e.canvasy = y;

		that.last_mouse[0] = x;
		that.last_mouse[1] = y;

		e.preventDefault();
		e.stopPropagation();
		return false;
    }

    ctx.onmousedown = function(e){
    
        that.dragging = true;

		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		e.canvasx = x;
		e.canvasy = y;

		that.last_mouse[0] = x;
		that.last_mouse[1] = y;

		e.preventDefault();
		e.stopPropagation();
		return false;
    }

	ctx.onmouseup = function(e){
	
		that.dragging = false;

		HDRI.onmouseup();

		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		e.canvasx = x;
		e.canvasy = y;

		that.last_mouse[0] = x;
		that.last_mouse[1] = y;

		e.preventDefault();
		e.stopPropagation();
		return false;

	}
}

/*DragAndScale.prototype.bindEvents = function( element )
{
	this.element = element;

	this._binded_mouse_callback = this.onMouse.bind(this);

	element.addEventListener("mousedown", this._binded_mouse_callback );
	element.addEventListener("mousemove", this._binded_mouse_callback );

	element.addEventListener("mousewheel", this._binded_mouse_callback, false);
	element.addEventListener("wheel", this._binded_mouse_callback, false);
}

DragAndScale.prototype.onMouse = function(e)
{
	var canvas = this.element;
	var rect = canvas.getBoundingClientRect();
	var x = e.clientX - rect.left;
	var y = e.clientY - rect.top;
	e.canvasx = x;
	e.canvasy = y;
	e.dragging = this.dragging;

	var ignore = false;
	if(this.onmouse)
		ignore = this.onmouse(e);

	if(e.type == "mousedown")
	{
		this.dragging = true;
		canvas.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.addEventListener("mousemove", this._binded_mouse_callback  );
		document.body.addEventListener("mouseup", this._binded_mouse_callback );
	}
	else if(e.type == "mousemove")
	{
		if(!ignore)
		{
			if(e.shiftKey)
				HDRI.shifting = true;
			else
				HDRI.shifting = false;

			var deltax = x - this.last_mouse[0];
			var deltay = y - this.last_mouse[1];

			if( this.dragging ){

				if(e.shiftKey){

					var pos = HDRI.toOffset();

					if(!HDRI.originCaptured) {
						HDRI.cropOrigin = pos;
						HDRI.originCaptured = true;
					}

					HDRI.cropSize[0] = pos[0] - HDRI.cropOrigin[0];
					HDRI.cropSize[1] = pos[1] - HDRI.cropOrigin[1];
				}
				else
					this.mouseDrag( deltax, deltay );
			}
		}
	}
	else if(e.type == "mouseup")
	{
		this.dragging = false;
		
		if(HDRI.originCaptured)
			HDRI.updateArea(true);

		HDRI.originCaptured = false;

		document.body.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.removeEventListener("mouseup", this._binded_mouse_callback );
		canvas.addEventListener("mousemove", this._binded_mouse_callback  );
	}
	else if(e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
	{ 
		e.eventType = "mousewheel";
		if(e.type == "wheel")
			e.wheel = -e.deltaY;
		else
			e.wheel = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);

		//from stack overflow
		e.delta = e.wheelDelta ? e.wheelDelta/40 : e.deltaY ? -e.deltaY/3 : 0;
		this.changeDeltaScale(1.0 + e.delta * 0.05);
	}

	this.last_mouse[0] = x;
	this.last_mouse[1] = y;

	e.preventDefault();
	e.stopPropagation();
	return false;
}*/

DragAndScale.prototype.toCanvasContext = function( ctx )
{
	ctx.scale( this.scale, this.scale );
	ctx.translate( this.offset[0], this.offset[1] );
}

DragAndScale.prototype.convertOffsetToCanvas = function(pos)
{
	//return [pos[0] / this.scale - this.offset[0], pos[1] / this.scale - this.offset[1]];
	return [ (pos[0] + this.offset[0]) * this.scale, (pos[1] + this.offset[1]) * this.scale ];
}

DragAndScale.prototype.convertCanvasToOffset = function(pos)
{
	return [pos[0] / this.scale - this.offset[0] , 
		pos[1] / this.scale - this.offset[1]  ];
}

DragAndScale.prototype.mouseDrag = function(x,y)
{
	this.offset[0] += x / this.scale;
	this.offset[1] += y / this.scale;

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeScale = function( value, zooming_center )
{
	if(value < this.min_scale)
		value = this.min_scale;
	else if(value > this.max_scale)
		value = this.max_scale;

	if(value == this.scale)
		return;

	if(!this.element)
		return;

	var rect = this.element.getBoundingClientRect();
	if(!rect)
		return;

	zooming_center = zooming_center || [rect.width * 0.5,rect.height * 0.5];
	var center = this.convertCanvasToOffset( zooming_center );
	this.scale = value;

	var new_center = this.convertCanvasToOffset( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.offset[0] += delta_offset[0];
	this.offset[1] += delta_offset[1];

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeDeltaScale = function( value, zooming_center )
{
	this.changeScale( this.scale * value, zooming_center );
}
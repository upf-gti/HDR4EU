/*
*   Alex Rodriguez
*   @jxarco 
*/

function ColorPicker()
{
	if(this.constructor !== ColorPicker)
		throw("Use new");

	this.button = null;
	this.enabled = false;
}

Object.assign( ColorPicker.prototype, {

	setup() {
		var container = document.createElement('div');
		container.className = "pixelPicker";
		var text = document.createElement('span');
		text.id = "pixelPickerCoord";
		text.innerHTML = "RGB";
		container.appendChild(text);
		document.body.appendChild(container);

		var button = document.querySelector(".tool-colorpicker");
		if(!button)
			console.error('something missing :(');

		this.button = $(button);

		var that = this;

		this.button.on('click', function(){
		
			$(this).addClass("enabled");
			CORE.getCanvas().style.cursor = 'crosshair';
			that.enabled = true;
		});
	},

	getColor(e) {

		var mouse = [e.canvasx, gl.canvas.height - e.canvasy];
		var x = parseInt(mouse[0]), y = parseInt(mouse[1]);

		if(x == null || y == null) throw('No mouse'); 

		var WIDTH = CORE._viewport_tex.width;
		var HEIGHT = CORE._viewport_tex.height;

		y = HEIGHT - y;

		var pixel = 4 * (y * WIDTH + x);

		var pixelColor = [
			CORE._viewport_tex.getPixels()[pixel],
			CORE._viewport_tex.getPixels()[pixel+1],
			CORE._viewport_tex.getPixels()[pixel+2],
			CORE._viewport_tex.getPixels()[pixel+3],
		];

		document.querySelector("#pixelPickerCoord").innerHTML = 'R: '+pixelColor[0].toFixed(4)+' G: '+pixelColor[1].toFixed(4)+' B: '+pixelColor[2].toFixed(4);

		this.enabled = false;
		this.button.removeClass("enabled");
		CORE.getCanvas().style.cursor = 'default';
	}

} );

RM.registerComponent( ColorPicker, 'ColorPicker');
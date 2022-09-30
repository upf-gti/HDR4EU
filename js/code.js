/*
*   Alex Rodriguez
*   @jxarco 
*/

var APP = {
    
    init(){

        var that = this;

     
    },

    bindDOM() {

    },

    onDropFile(e, domElement)
    {
        e.preventDefault();
        e.stopPropagation();

       
    },

    download(file)
    {
        LiteGUI.downloadURL(FS.root + tmpFiles[ file ].fullpath, file)
    }
    
}

function getDate(exact_time)
{
    var today = new Date();
    var dd = today.getDate();
    var yy = today.getFullYear();
    var mm = today.getMonth()+1; //January is 0!
    var h = today.getHours();
    var mins = today.getMinutes();

    if(dd<10) dd = '0'+dd
    if(mm<10) mm = '0'+mm
    if(h<10) h = '0'+h
    if(mins<10) mins = '0'+mins

    today = dd+'/'+mm+'/'+ yy + (exact_time ? " - " + h + ':'+mins : "");
    return today;
}

function openTab(url)
{
    var win = window.open(url, '_blank');
    win.focus();
}
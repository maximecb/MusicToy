/*****************************************************************************
*
* Copyright (C) 2012 Maxime Chevalier-Boisvert
* 
* The source code contained within this file was written by Maxime
* Chevalier-Boisvert. Duplication or redistribution of this code
* without prior authorization from the author constitutes copyright
* violation.
*
* For more information about this program, please e-mail the
* author, Maxime Chevalier-Boisvert at:
* maximechevalierb /at/ gmail /dot/ com
* 
*****************************************************************************/

//============================================================================
// Page interface code
//============================================================================

/**
Called after page load to initialize needed resources
*/
function init()
{
    // Get a reference to the canvas
    canvas = document.getElementById("canvas");

    // Get a 2D context for the drawing canvas
    canvasCtx = canvas.getContext("2d");

    // Create an audio context
    if (this.hasOwnProperty('AudioContext') === true)
    {
        //console.log('Audio context found');
        audioCtx = new AudioContext();
    }
    else if (this.hasOwnProperty('webkitAudioContext') === true)
    {
        //console.log('WebKit audio context found');
        audioCtx = new webkitAudioContext();
    }
    else
    {
        audioCtx = undefined;
    }

    // If an audio context was created
    if (audioCtx !== undefined)
    {
        // Get the sample rate for the audio context
        var sampleRate = audioCtx.sampleRate;

        console.log('Sample rate: ' + audioCtx.sampleRate);

        // Size of the audio generation buffer
        var bufferSize = 2048;
    }
    else
    {
        alert(
            'No Web Audio API support. Sound will be disabled. ' +
            'Try this page in the latest version of Chrome'
        );

        var sampleRate = 44100;
    }

    // Create a synthesis network
    var synthNet = new SynthNet(sampleRate);

    // Create a piece
    var piece = new Piece(synthNet);

    // Initialize the synth network
    initSynth(synthNet, piece);

    // Create an audio generation event handler
    var genAudio = piece.makeHandler();

    // JS audio node to produce audio output
    var jsAudioNode = undefined;

    playAudio = function ()
    {
        // If audio is disabled, stop
        if (audioCtx === undefined)
            return;

        // If the audio isn't stopped, stop it
        if (jsAudioNode !== undefined)
            stopAudio()

        // Set the playback time on the piece to 0 (start)
        piece.setTime(0);

        // Create a JS audio node and connect it to the destination
        jsAudioNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);
        jsAudioNode.onaudioprocess = genAudio;
	    jsAudioNode.connect(audioCtx.destination);

        //drawInterv = setInterval(drawTrack, 100);
    }

    stopAudio = function ()
    {
        // If audio is disabled, stop
        if (audioCtx === undefined)
            return;

        if (jsAudioNode === undefined)
            return;

        // Notify the piece that we are stopping playback
        piece.stop();

        // Disconnect the audio node
        jsAudioNode.disconnect();
        jsAudioNode = undefined;

        // Clear the drawing interval
        //clearInterval(drawInterv);
    }
}

// Attach the init function to the load event
if (window.addEventListener)
    window.addEventListener('load', init, false); 
else if (document.addEventListener)
    document.addEventListener('load', init, false); 
else if (window.attachEvent)
    window.attachEvent('onload', init); 

// Default console logging function implementation
if (!window.console) console = {};
console.log = console.log || function(){};
console.warn = console.warn || function(){};
console.error = console.error || function(){};
console.info = console.info || function(){};

// Check for typed array support
if (!this.Float64Array)
{
    console.log('No Float64Array support');
    Float64Array = Array;
}


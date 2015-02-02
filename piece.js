/*****************************************************************************
*
*  This file is part of the MusicToy project. The project is
*  distributed at:
*  https://github.com/maximecb/MusicToy
*
*  Copyright (c) 2012, Maxime Chevalier-Boisvert. All rights reserved.
*
*  This software is licensed under the following license (Modified BSD
*  License):
*
*  Redistribution and use in source and binary forms, with or without
*  modification, are permitted provided that the following conditions are
*  met:
*   1. Redistributions of source code must retain the above copyright
*      notice, this list of conditions and the following disclaimer.
*   2. Redistributions in binary form must reproduce the above copyright
*      notice, this list of conditions and the following disclaimer in the
*      documentation and/or other materials provided with the distribution.
*   3. The name of the author may not be used to endorse or promote
*      products derived from this software without specific prior written
*      permission.
*
*  THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED
*  WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
*  MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN
*  NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
*  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
*  NOT LIMITED TO PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
*  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
*  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
*  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
*  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*
*****************************************************************************/

//============================================================================
// Music piece implementation
//============================================================================

/**
@class Musical piece implementation.
*/
function Piece(synthNet)
{
    assert (
        synthNet instanceof SynthNet || synthNet === undefined,
        'invalid synth net'
    );

    /**
    Synthesis network used by this piece
    */
    this.synthNet = synthNet;

    /**
    Music/info tracks
    */
    this.tracks = [];

    /**
    Current playback time/position
    */
    this.playTime = 0;

    /**
    Loop time
    */
    this.loopTime = 0;

    /**
    Previous update time
    */
    this.prevTime = 0;

    /**
    Tempo in beats per minute
    */
    this.beatsPerMin = 140;

    /**
    Time signature numerator, beats per bar
    */
    this.beatsPerBar = 4;

    /**
    Time signature denominator, note value for each beat
    */
    this.noteVal = 4;
}

/**
Add a track to the piece
*/
Piece.prototype.addTrack = function (track)
{
    assert (
        track instanceof Track,
        'invalid track'
    );

    this.tracks.push(track);

    return track;
}

/**
Get the time offset for a beat number. This number can be fractional.
*/
Piece.prototype.beatTime = function (beatNo)
{
    var beatLen = 60 / this.beatsPerMin;

    return beatLen * beatNo;
}

/**
Get the length in seconds for a note value multiple
*/
Piece.prototype.noteLen = function (len)
{
    // By default, use the default note value
    if (len === undefined)
        len = 1;

    var beatLen = 60 / this.beatsPerMin;

    var barLen = beatLen * this.beatsPerBar;

    var noteLen = barLen / this.noteVal;

    return len * noteLen * 0.99;
}

/**
Helper methods to add notes to the track.
Produces a note-on and note-off event pair.
*/
Piece.prototype.makeNote = function (track, beatNo, note, len, vel)
{
    assert (
        note instanceof Note ||
        typeof note === 'string',
        'invalid note'
    );

    if (typeof note === 'string')
        note = new Note(note);

    // By default, the velocity is 100%
    if (vel === undefined)
        vel = 1;

    // Convert the note time to a beat number        
    var time = this.beatTime(beatNo);

    // Get the note length in seconds
    var noteLen = this.noteLen(len);

    // Create the note on and note off events
    var noteOn = new NoteOnEvt(time, note, vel);
    var noteOff = new NoteOffEvt(time + noteLen, note);

    // Add the events to the track
    track.addEvent(noteOn);
    track.addEvent(noteOff);
}

/**
Set the playback position/time
*/
Piece.prototype.setTime = function (time)
{
    this.playTime = time;
}

/**
Dispatch synthesis events up to the current time
*/
Piece.prototype.dispatch = function (curTime, realTime)
{
    // Do the dispatch for each track
    for (var i = 0; i < this.tracks.length; ++i)
    {
        var track = this.tracks[i];

        track.dispatch(this.prevTime, curTime, realTime);
    }

    // Store the last update time/position
    this.prevTime = curTime;
}

/**
Called when stopping the playback of a piece
*/
Piece.prototype.stop = function ()
{
    // If a synthesis network is attached to this piece
    if (this.synthNet !== undefined)
    {
        // Send an all notes off event to all synthesis nodes
        var notesOffEvt = new AllNotesOffEvt();
        for (var i = 0; i < this.synthNet.nodes.length; ++i)
        {
            var node = this.synthNet.nodes[i];
            node.processEvent(notesOffEvt);
        }
    }

    // Set the playback position past all events
    this.playTime = Infinity;
}

/**
Create a handler for real-time audio generation
*/
Piece.prototype.makeHandler = function ()
{
    var synthNet = this.synthNet;
    var piece = this;

    var sampleRate = synthNet.sampleRate;

    // Output node of the synthesis network
    var outNode = synthNet.outNode;

    // Current playback time
    var curTime = piece.playTime;
    var realTime = piece.playTime;

    // Audio generation function
    function genAudio(evt)
    {
        var startTime = (new Date()).getTime();

        var numChans = evt.outputBuffer.numberOfChannels
        var numSamples = evt.outputBuffer.getChannelData(0).length;

        // If the playback position changed, update the current time
        if (piece.playTime !== curTime)
        {
            console.log('playback time updated');
            curTime = piece.playTime;
        }

        assert (
            numChans === outNode.numChans,
            'mismatch in the number of output channels'
        );

        assert (
            numSamples % SYNTH_BUF_SIZE === 0,
            'the output buffer size must be a multiple of the synth buffer size'
        );
        
        // Until all samples are produced
        for (var smpIdx = 0; smpIdx < numSamples; smpIdx += SYNTH_BUF_SIZE)
        {
            // Update the piece, dispatch track events
            piece.dispatch(curTime, realTime);

            // Generate the sample values
            var values = synthNet.genOutput(realTime);

            // Copy the values for each channel
	        for (var chnIdx = 0; chnIdx < numChans; ++chnIdx)
            {
                var srcBuf = outNode.getBuffer(chnIdx);
                var dstBuf = evt.outputBuffer.getChannelData(chnIdx);

                for (var i = 0; i < SYNTH_BUF_SIZE; ++i)
                    dstBuf[smpIdx + i] = srcBuf[i];
            }

            // Update the current time based on sample rate
            curTime  += SYNTH_BUF_SIZE / sampleRate;
            realTime += SYNTH_BUF_SIZE / sampleRate;

            // If we lust passed the loop time, go back to the start
            if (piece.playTime <= piece.loopTime &&
                curTime > piece.loopTime)
            {
                piece.dispatch(piece.loopTime + 0.01, realTime);

                curTime = 0;
                piece.prevTime = 0;
            }

            // Update the current playback position
            piece.playTime = curTime;
        }

        var endTime = (new Date()).getTime();
        var compTime = (endTime - startTime) / 1000;
        var soundTime = (numSamples / synthNet.sampleRate);
        var cpuUse = (100 * compTime / soundTime).toFixed(1);

        //console.log('cpu use: ' + cpuUse + '%');
    }

    // Return the handler function
    return genAudio;
}

/**
Draw the notes of a track using the canvas API
*/
Piece.prototype.drawTrack = function (
    track, 
    canvasCtx, 
    topX, 
    topY, 
    width, 
    height,
    minNote,
    numOcts
)
{
    // Compute the bottom-right corner coordinates
    var botX = topX + width;
    var botY = topY + height;

    // Get the last event time
    var maxTime = track.endTime();

    // Compute the number of beats
    var numBeats = Math.ceil((maxTime / 60) * this.beatsPerMin);

    // Compute the total time for the beats
    var totalTime = (numBeats / this.beatsPerMin) * 60;

    //console.log('max time  : ' + maxTime);
    //console.log('num beats : ' + numBeats);
    //console.log('total time: ' + totalTime);

    var minNoteNo = Math.floor(minNote.noteNo / NOTES_PER_OCTAVE) * NOTES_PER_OCTAVE;

    var numNotes = numOcts * NOTES_PER_OCTAVE;

    var numWhites = numOcts * 7;

    var whiteHeight = height / numWhites;

    var blackHeight = whiteHeight / 2;

    var pianoWidth = 40;

    var blackWidth = (pianoWidth / 4) * 3;

    var beatWidth = (width - pianoWidth) / numBeats;

    canvasCtx.fillStyle = "grey"
    canvasCtx.fillRect(topX, topY, width, height);

    canvasCtx.fillStyle = "white"
    canvasCtx.fillRect(topX, topY, pianoWidth, height);

    canvasCtx.strokeStyle = "black";
    canvasCtx.beginPath();
    canvasCtx.moveTo(topX, topY);
    canvasCtx.lineTo(topX + pianoWidth, topY);
    canvasCtx.lineTo(topX + pianoWidth, botY);
    canvasCtx.lineTo(topX, botY);
    canvasCtx.closePath();
    canvasCtx.stroke();

    var noteExts = new Array(numNotes);
    var noteIdx = 0;

    // For each white note
    for (var i = 0; i < numWhites; ++i)
    {
        var whiteBot = botY - (whiteHeight * i);
        var whiteTop = whiteBot - whiteHeight;

        var whiteExts = noteExts[noteIdx++] = { bot: whiteBot, top: whiteTop };

        if (i > 0)
        {
            var prevExts = noteExts[noteIdx - 2];
            whiteExts.bot = Math.min(whiteExts.bot, prevExts.top);
        }

        canvasCtx.strokeStyle = "black";
        canvasCtx.beginPath();
        canvasCtx.moveTo(topX, whiteBot);
        canvasCtx.lineTo(topX + pianoWidth, whiteBot);
        canvasCtx.closePath();
        canvasCtx.stroke();

        if ((i % 7) !== 2 && (i % 7) !== 6)
        {
            var blackTop = whiteTop - (blackHeight / 2);
            var blackBot = whiteTop + (blackHeight / 2);

            var blackExts = noteExts[noteIdx++] = { bot:blackBot, top:blackTop };
            whiteExts.top = blackExts.bot;

            canvasCtx.fillStyle = "black";
            canvasCtx.beginPath();
            canvasCtx.moveTo(topX, blackTop);
            canvasCtx.lineTo(topX + blackWidth, blackTop);
            canvasCtx.lineTo(topX + blackWidth, blackBot);
            canvasCtx.lineTo(topX, blackBot);
            canvasCtx.lineTo(topX, blackTop);
            canvasCtx.closePath();
            canvasCtx.fill();
        }
    }

    // Draw the horizontal note separation lines
    for (var i = 0; i < noteExts.length; ++i)
    {
        var exts = noteExts[i];

        canvasCtx.strokeStyle = "rgb(0, 0, 125)";
        canvasCtx.beginPath();
        canvasCtx.moveTo(topX + pianoWidth + 1, exts.top);
        canvasCtx.lineTo(botX, exts.top);
        canvasCtx.closePath();
        canvasCtx.stroke();
    }

    // Draw the vertical beat separation lines
    for (var i = 1; i < numBeats; ++i)
    {
        var xCoord = topX + pianoWidth + (i * beatWidth);

        var color;
        if (i % this.beatsPerBar === 0)
            color = "rgb(25, 25, 255)"
        else
            color = "rgb(0, 0, 125)";

        canvasCtx.strokeStyle = color;
        canvasCtx.beginPath();
        canvasCtx.moveTo(xCoord, topY);
        canvasCtx.lineTo(xCoord, botY);
        canvasCtx.closePath();
        canvasCtx.stroke();
    }   

    // For each track event
    for (var i = 0; i < track.events.length; ++i)
    {
        var event = track.events[i];

        // If this is a note on event
        if (event instanceof NoteOnEvt)
        {
            var noteNo = event.note.noteNo;
            var startTime = event.time;

            // Try to find the note end time
            //var endTime = startTime + (60 / this.beatsPerMin);
            var endTime = undefined;
            for (var j = i + 1; j < track.events.length; ++j)
            {
                var e2 = track.events[j];

                if (e2 instanceof NoteOffEvt &&
                    e2.note.noteNo === noteNo &&
                    e2.time > event.time)
                {
                    endTime = e2.time;
                    break;
                }
            }

            if (endTime === undefined)
                error('COULD NOT FIND NOTE OFF');

            var startFrac = startTime / totalTime;
            var endFrac = endTime / totalTime;

            var xStart = topX + pianoWidth + startFrac * (width - pianoWidth);
            var xEnd = topX + pianoWidth + endFrac * (width - pianoWidth);

            var noteIdx = noteNo - minNoteNo;

            if (noteIdx >= noteExts.length)
            {
                console.log('note above limit');
                continue;
            }

            //console.log(noteIdx + ': ' + xStart + ' => ' + xEnd);

            var exts = noteExts[noteIdx];

            canvasCtx.fillStyle = "red";
            canvasCtx.strokeStyle = "black";
            canvasCtx.beginPath();
            canvasCtx.moveTo(xStart, exts.top);
            canvasCtx.lineTo(xEnd  , exts.top);
            canvasCtx.lineTo(xEnd  , exts.bot);
            canvasCtx.lineTo(xStart, exts.bot);
            canvasCtx.lineTo(xStart, exts.top);
            canvasCtx.closePath();
            canvasCtx.fill();
            canvasCtx.stroke();
        }
    }

    // If playback is ongoing
    if (this.playTime !== 0 && maxTime !== 0)
    {
        // Compute the cursor line position
        var cursorFrac = this.playTime / maxTime;
        var cursorPos = topX + pianoWidth + cursorFrac * (width - pianoWidth);

        // Draw the cursor line
        canvasCtx.strokeStyle = "white";
        canvasCtx.beginPath();
        canvasCtx.moveTo(cursorPos, topY);
        canvasCtx.lineTo(cursorPos, botY);
        canvasCtx.closePath();
        canvasCtx.stroke();
    }
}

/**
Produce MIDI file data for a track of this piece. 
The data is written into a byte array.
*/
Piece.prototype.getMIDIData = function (track)
{
    var data = [];

    var writeIdx = 0;

    function writeByte(val)
    {
        assert (
            val <= 0xFF,
            'invalid value in writeByte'
        );

        data[writeIdx++] = val;
    }

    function writeWORD(val)
    {
        assert (
            val <= 0xFFFF,
            'invalid value in writeWORD'
        );

        writeByte((val >> 8) & 0xFF);
        writeByte((val >> 0) & 0xFF);
    }

    function writeDWORD(val)
    {
        assert (
            val <= 0xFFFFFFFF,
            'invalid value in writeDWORD: ' + val
        );

        writeByte((val >> 24) & 0xFF);
        writeByte((val >> 16) & 0xFF);
        writeByte((val >> 8) & 0xFF);
        writeByte((val >> 0) & 0xFF);
    }

    function writeVarLen(val)
    {
        // Higher bits must be written first

        var bytes = [];

        do 
        {
            var bits = val & 0x7F;

            val >>= 7;

            bytes.push(bits);

        } while (val !== 0);

        for (var i = bytes.length - 1; i >= 0; --i)
        {
            var bits = bytes[i];

            if (i > 0)
                bits = 0x80 | bits;

            writeByte(bits);
        }
    }

    // Number of clock ticks per beat
    var ticksPerBeat = 500;

    // Write the file header
    writeDWORD(0x4D546864);     // MThd
    writeDWORD(0x00000006);     // Chunk size
    writeWORD(0);               // Type 0 MIDI file (one track)
    writeWORD(1);               // One track
    writeWORD(ticksPerBeat);    // Time division

    // Write the track header
    writeDWORD(0x4D54726B)  // MTrk
    writeDWORD(0);          // Chunk size, written later

    // Save the track size index
    var trackSizeIdx = data.length - 4;

    // Delta time conversion ratio
    var ticksPerSec = (this.beatsPerMin / 60) * ticksPerBeat;

    console.log('ticks per sec: ' + ticksPerSec);

    // Set the tempo in microseconds per quarter node
    var usPerMin = 60000000;
    var mpqn = usPerMin / this.beatsPerMin;
    writeVarLen(0);
    writeByte(0xFF)
    writeByte(0x51);
    writeVarLen(3);
    writeByte((mpqn >> 16) & 0xFF);
    writeByte((mpqn >> 8) & 0xFF);
    writeByte((mpqn >> 0) & 0xFF);

    // Set the time signature
    var num32Nds = Math.floor(8 * (4 / this.noteVal));
    writeVarLen(0);
    writeByte(0xFF)
    writeByte(0x58);
    writeVarLen(4);
    writeByte(this.beatsPerBar);    // Num
    writeByte(2);                   // Denom 2^2 = 4
    writeByte(24);                  // Metronome rate
    writeByte(num32Nds);            // 32nds per quarter note

    console.log('beats per bar: ' + this.beatsPerBar);
    console.log('num 32nds: ' + num32Nds);

    // Set the piano program
    writeVarLen(0);
    writeByte(0xC0);
    writeByte(0);

    // For each track event
    for (var i = 0; i < track.events.length; ++i)
    {
        var event = track.events[i];
        var prevEvent = track.events[i-1];

        // Event format:
        // Delta Time	
        // Event Type Value	
        // MIDI Channel	
        // Parameter 1	
        // Parameter 2

        var deltaTime = prevEvent? (event.time - prevEvent.time):0;

        var deltaTicks = Math.ceil(ticksPerSec * deltaTime);

        assert (
            isNonNegInt(deltaTicks),
            'invalid delta ticks: ' + deltaTicks
        );

        console.log(event.toString())
        console.log('delta ticks: ' + deltaTicks);

        // Write the event delta time
        writeVarLen(deltaTicks);

        if (event instanceof NoteOnEvt)
        {
            writeByte(0x90);

            writeByte(event.note.noteNo);

            // Velocity
            var vel = Math.min(Math.floor(event.vel * 127), 127);
            writeByte(vel);
        }

        else if (event instanceof NoteOffEvt)
        {
            writeByte(0x80);

            writeByte(event.note.noteNo);

            // Velocity
            writeByte(0);
        }
    }

    // Write the end of track event
    writeVarLen(0);
    writeByte(0xFF)
    writeByte(0x2F);
    writeVarLen(0);

    // Write the track chunk size
    var trackSize = data.length - (trackSizeIdx + 4);
    console.log('track size: ' + trackSize);
    writeIdx = trackSizeIdx
    writeDWORD(trackSize);

    return data;
}

/**
@class Synthesis event track implementation. Produces events and sends them
to a target synthesis node.
*/
function Track(target)
{
    assert (
        target instanceof SynthNode || target === undefined,
        'invalid target node'
    );

    /**
    Target synthesis node to send events to
    */
    this.target = target;

    /**
    Events for this track
    */
    this.events = [];
}

/**
Add an event to the track
*/
Track.prototype.addEvent = function (evt)
{
    this.events.push(evt);

    // If the event is being added at the end of the track, stop
    if (this.events.length === 1 ||
        evt.time >= this.events[this.events.length-2].time)
        return;

    // Sort the events
    this.events.sort(function (a, b) { return a.time - b.time; });
}

/**
Get the dispatch time of the last event
*/
Track.prototype.endTime = function ()
{
    if (this.events.length === 0)
        return
    else
        return this.events[this.events.length-1].time;
}

/**
Dispatch the events between the previous update time and
the current time, inclusively.
*/
Track.prototype.dispatch = function (prevTime, curTime, realTime)
{
    if (this.target === undefined)
        return;

    if (this.events.length === 0)
        return;

    // Must play all events from the previous time (inclusive) up to the
    // current time (exclusive).
    //
    // Find the mid idx where we are at or just past the previous time.

    var minIdx = 0;
    var maxIdx = this.events.length - 1;

    var midIdx = 0;

    while (minIdx <= maxIdx)
    {
        midIdx = Math.floor((minIdx + maxIdx) / 2);

        //console.log(midIdx);

        var midTime = this.events[midIdx].time;

        var leftTime = (midIdx === 0)? -Infinity:this.events[midIdx-1].time;

        if (leftTime < prevTime && midTime >= prevTime)
            break;

        if (midTime < prevTime)
            minIdx = midIdx + 1;
        else
            maxIdx = midIdx - 1;
    }

    // If no event to dispatch were found, stop
    if (minIdx > maxIdx)
        return;

    // Dispatch all events up to the current time (exclusive)
    for (var idx = midIdx; idx < this.events.length; ++idx)
    {
        var evt = this.events[idx];

        if (evt.time >= curTime)
            break;

        console.log('Dispatch: ' + evt);

        this.target.processEvent(evt, realTime);
    }
}

/**
Clear all the events from this track
*/
Track.prototype.clear = function ()
{
    this.events = [];
}

//============================================================================
// Synthesis events
//============================================================================

/**
@class Base class for all synthesis events.
*/
function SynthEvt()
{
    /**
    Event occurrence time
    */
    this.time = 0;
}

/**
Format a synthesis event string representation
*/
SynthEvt.formatStr = function (evt, str)
{
    return evt.time.toFixed(2) + ': ' + str;
}

/**
Default string representation for events
*/
SynthEvt.prototype.toString = function ()
{
    return SynthEvt.formatStr(this, 'event');
}

/**
@class Note on event
*/
function NoteOnEvt(time, note, vel)
{
    // By default, use the C4 note
    if (note === undefined)
        note = new Note(C4_NOTE_NO);

    // By default, 50% velocity
    if (vel === undefined)
        vel = 0.5;

    /**
    Note
    */
    this.note = note;

    /**
    Velocity
    */
    this.vel = vel;

    // Set the event time
    this.time = time;
}
NoteOnEvt.prototype = new SynthEvt();

/**
Default string representation for events
*/
NoteOnEvt.prototype.toString = function ()
{
    return SynthEvt.formatStr(this, 'note-on ' + this.note);
}

/**
@class Note off event
*/
function NoteOffEvt(time, note)
{
    // By default, use the C4 note
    if (note === undefined)
        note = new Note(C4_NOTE_NO);

    /**
    Note
    */
    this.note = note;

    // Set the event time
    this.time = time;
}
NoteOffEvt.prototype = new SynthEvt();

/**
Default string representation for events
*/
NoteOffEvt.prototype.toString = function ()
{
    return SynthEvt.formatStr(this, 'note-off ' + this.note);
}

/**
@class All notes off event. Silences instruments.
*/
function AllNotesOffEvt(time)
{
    this.time = time;
}
AllNotesOffEvt.prototype = new SynthEvt();

/**
Default string representation for events
*/
AllNotesOffEvt.prototype.toString = function ()
{
    return SynthEvt.formatStr(this, 'all notes off');
}


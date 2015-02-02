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

/**
@class Simple multi-input mixer
*/
function Mixer(numInputs, numChans)
{
    if (numInputs === undefined)
        numInputs = 8;

    if (numChans === undefined)
        numChans = 2;

    /**
    Number of input/output channels
    */
    this.numChans = numChans;

    /**
    Input volume(s), one value per input
    */
    this.inVolume = new Float64Array(numInputs);

    /**
    Input panning settings, one value per input in [-1, 1]
    */
    this.inPanning = new Float64Array(numInputs);

    /**
    Output volume
    */
    this.outVolume = 1;

    /**
    List of inputs
    */
    this.inputs = new Array(numInputs);

    // For each input
    for (var i = 0; i < numInputs; ++i)
    {
        // Initialize the volume to 1
        this.inVolume[i] = 1;

        // Initialize the panning to 0 (centered)
        this.inPanning[i] = 0;

        // Audio input signal
        this.inputs[i] = new SynthInput(this, 'input' + i, numChans);
    }

    // Audio output
    new SynthOutput(this, 'output', numChans);

    // Default name for this node
    this.name = 'mixer';
}
Mixer.prototype = new SynthNode();

/**
Update the outputs based on the inputs
*/
Mixer.prototype.update = function (time, sampleRate)
{
    // Count the number of inputs having produced data
    var actCount = 0;
    for (var inIdx = 0; inIdx < this.inputs.length; ++inIdx)
        if (this.inputs[inIdx].hasData() === true)
            ++actCount;

    // If there are no active inputs, do nothing
    if (actCount === 0)
        return;

    // Initialize the output to 0
    for (var chIdx = 0; chIdx < this.numChans; ++chIdx)
    {
        var outBuf = this.output.getBuffer(chIdx);
        for (var i = 0; i < outBuf.length; ++i)
            outBuf[i] = 0;
    }

    // For each input
    for (var inIdx = 0; inIdx < this.inputs.length; ++inIdx)
    {
        // Get the input
        var input = this.inputs[inIdx];

        // If this input has no available data, skip it
        if (input.hasData() === false)
            continue;

        // For each channel
        for (var chIdx = 0; chIdx < this.numChans; ++chIdx)
        {
            // Get the input buffer
            var inBuf = input.getBuffer(chIdx);

            // Get the volume for this input
            var inVolume = this.inVolume[inIdx];

            // Get the output buffer
            var outBuf = this.output.getBuffer(chIdx);

            // If we are operating in stereo
            if (this.numChans === 2)
            {
                var inPanning = this.inPanning[inIdx];

                // Scale the channel volumes based on the panning level
                if (chIdx === 0)
                    inVolume *= (1 - inPanning) / 2;
                else if (chIdx === 1)
                    inVolume *= (1 + inPanning) / 2;
            }

            // Scale the input and add it to the output
            for (var i = 0; i < inBuf.length; ++i)
                outBuf[i] += inBuf[i] * inVolume;
        }
    }

    // Scale the output according to the output volume
    for (var chIdx = 0; chIdx < this.numChans; ++chIdx)
    {
        var outBuf = this.output.getBuffer(chIdx);
        for (var i = 0; i < outBuf.length; ++i)
            outBuf[i] *= this.outVolume;
    }
}


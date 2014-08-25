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

/**
Draw a graph in a canvas
*/
function drawGraph(ctx, startX, startY, width, height, data, yMin, yMax)
{
    assert (
        data.length >= 2,
        'too few samples'
    );

    // Compute the number of samples and lines
    var numSamples = Math.min(data.length, width); 
    var numLines = numSamples - 1;

    // Resample the input data
    var samples = resample(
        data,
        numSamples,
        startY + height - 1,
        startY,
        yMin,
        yMax
    );

    var xSpread = width / numLines;

    ctx.beginPath();

    // For each line to draw
    for (var i = 0; i < numLines; ++i)
    {
        var v0 = samples[i];
        var v1 = samples[i+1];

        var x0 = startX + (i * xSpread);
        var x1 = x0 + xSpread;

        ctx.moveTo(x0, v0);  
        ctx.lineTo(x1, v1);
    }

    ctx.stroke();
}


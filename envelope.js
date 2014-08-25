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
@class Attack-Decay-Sustain-Release envelope implementation
*/
function ADSREnv(a, d, s, r)
{
    /**
    Attack time
    */
    this.a = a;

    /**
    Decay time
    */
    this.d = d;

    /**
    Sustain amplitude [0,1]
    */
    this.s = s;

    /**
    Release time
    */
    this.r = r;

    /**
    Attack curve exponent
    */
    this.aExp = 2;

    /**
    Decay curve exponent
    */
    this.dExp = 2;

    /**
    Release curve exponent
    */
    this.rExp = 2;
}

/**
Get the envelope value at a given time
*/
ADSREnv.prototype.getValue = function (curTime, onTime, offTime, onAmp, offAmp)
{
    // Interpolation function:
    // x ranges from 0 to 1
    function interp(x, yL, yR, exp)
    {
        // If the curve is increasing
        if (yR > yL)
        {
            return yL + Math.pow(x, exp) * (yR - yL);
        }
        else
        {
            return yR + Math.pow(1 - x, exp) * (yL - yR);
        }
    }

    if (offTime === 0)
    {
        var noteTime = curTime - onTime;

        if (noteTime < this.a)
        {
            return interp(noteTime / this.a, onAmp, 1, this.aExp);
        }
        else if (noteTime < this.a + this.d)
        {
            return interp((noteTime - this.a) / this.d , 1, this.s, this.dExp);
        }
        else
        {
            return this.s;
        }
    }
    else 
    {
        var relTime = curTime - offTime;

        if (relTime < this.r)
        {
            return interp(relTime / this.r, offAmp, 0, this.rExp);
        }
        else
        {
            return 0;
        }
    }
}


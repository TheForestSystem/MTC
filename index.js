const express = require('express');
const midi = require('midi');

const app = express();
app.use(express.json());

let timecode = {
    hours: 0,
    minutes: 0,
    seconds: 0,
    frames: 0
};

let fps = 24; // Frames per second
let interval = null;

// Set up a new output MIDI port
const output = new midi.Output();
output.openPort(1); // Adjust based on your setup

// Send Quarter Frame Messages for the current timecode
const sendMIDIQuarterFrame = () => {
    output.sendMessage([0xF1, timecode.frames & 0x0F]); // Frames LSB
    output.sendMessage([0xF1, 0x10 | ((timecode.frames >> 4) & 0x01)]); // Frames MSB
    output.sendMessage([0xF1, 0x20 | (timecode.seconds & 0x0F)]); // Seconds LSB
    output.sendMessage([0xF1, 0x30 | ((timecode.seconds >> 4) & 0x03)]); // Seconds MSB
    output.sendMessage([0xF1, 0x40 | (timecode.minutes & 0x0F)]); // Minutes LSB
    output.sendMessage([0xF1, 0x50 | ((timecode.minutes >> 4) & 0x03)]); // Minutes MSB
    output.sendMessage([0xF1, 0x60 | (timecode.hours & 0x0F)]); // Hours LSB
    output.sendMessage([0xF1, 0x70 | ((timecode.hours >> 4) & 0x01) | (fps === 30 ? 0x02 : 0x00)]); // Hours MSB + FPS
};

// Function to increment timecode
const incrementTimecode = () => {
    timecode.frames += 1;

    if (timecode.frames >= fps) {
        timecode.frames = 0;
        timecode.seconds += 1;
    }

    if (timecode.seconds >= 60) {
        timecode.seconds = 0;
        timecode.minutes += 1;
    }

    if (timecode.minutes >= 60) {
        timecode.minutes = 0;
        timecode.hours += 1;
    }

    if (timecode.hours >= 24) {
        timecode.hours = 0;
    }
};

// Function to start sending MIDI timecode
app.post('/start', (req, res) => {
    if (!interval) {
        const quarterFrameInterval = (1000 / fps) / 4; // Refined timing
        interval = setInterval(() => {
            sendMIDIQuarterFrame();
            incrementTimecode();
        }, quarterFrameInterval); // Now sends the correct timing
        res.send({ message: 'MIDI timecode started' });
    } else {
        res.send({ message: 'Timecode already running' });
    }
});

// POST to stop MIDI timecode
app.post('/stop', (req, res) => {
    if (interval) {
        clearInterval(interval);
        interval = null;
        res.send({ message: 'MIDI timecode stopped' });
    } else {
        res.send({ message: 'Timecode is not running' });
    }
});

// POST to toggle start/stop
app.post('/toggle', (req, res) => {
    if (interval) {
        clearInterval(interval);
        interval = null;
        timecode = { hours: 0, minutes: 0, seconds: 0, frames: 0 };
        res.send({ message: 'MIDI timecode stopped' });
    } else {
        const quarterFrameInterval = (1000 / fps) / 4; // Refined timing
        interval = setInterval(() => {
            sendMIDIQuarterFrame();
            incrementTimecode();
        }, quarterFrameInterval);
        res.send({ message: 'MIDI timecode started' });
    }
});

// POST to reset MIDI timecode
app.post('/reset', (req, res) => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    timecode = { hours: 0, minutes: 0, seconds: 0, frames: 0 };
    res.send({ message: 'MIDI timecode reset' });
});

// POST to get the current timecode
app.get('/timecode', (req, res) => {
    res.send({ timecode });
});

// Close the MIDI port when the server shuts down
process.on('exit', () => {
    output.closePort();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

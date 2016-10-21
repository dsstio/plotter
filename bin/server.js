"use strict"


const fs = require('fs');
const Url = require('url');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const htmlencode = require('htmlencode');
const child_process = require('child_process');
const qrcode = require('qrcode-generator');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/assets', express.static(path.resolve(__dirname, '../web/assets')));


app.all('/', function (req, res) {
	res.send(getPage())
})

app.post('/api', function (req, res) {
	const body = req.body;
	switch (body.action) {
		case 'printsmall': printSmallText(body.msg); break;
		case 'printbig': printBigText(body.msg); break;
		case 'printqrcode': printQRCode(body.msg); break;
	}
	res.send('thanks');
})

app.listen(9600, function (err) {
	if (err) throw err;
	console.log('Server started on port 9600');
})

function getPage() {
	return fs.readFileSync(path.resolve(__dirname, '../web/index.html'), 'utf8');
}

function printBigText(text) {
	let size = [1600, 720];
	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size',(text.length*300)+'x400',
		'canvas:black',
		'-fill','white',
		'-stroke','white',
		'-pointsize','300',
		'-draw','text 0,300 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',size.map(v => v-200).join('x')+'>',
		'-gravity','center',
		'-background','black',
		'-extent',size.join('x'),
		'-rotate','90',
		'-flop',
		'-depth','1',
		'gray:-'
	];
	size.reverse();

	renderImage(size, args);
}

function printQRCode(text) {
	let ok = false, version = 1, qr;

	while (!ok) {
		try {
			qr = qrcode(version, 'M');
			qr.addData(text);
			qr.make();
			ok = true;
		} catch (e) {
			version++;
		}
	}

	let svg = qr.createSvgTag(1, 2);
	var qrsize = svg.match(/width\=\"([0-9]+)/i)[1];
	var density = Math.floor(72*720/qrsize);

	let smallSize = [720, 150];
	let size = [smallSize[0], smallSize[0]+smallSize[1]];
	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size',(text.length*150)+'x200',
		'canvas:white',
		'-fill','black',
		'-stroke','black',
		'-pointsize','150',
		'-draw','text 0,150 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',smallSize.map(v => v-20).join('x')+'>',
		'-gravity','center',
		'-background','white',
		'-extent',smallSize.join('x'),
		'-gravity','south',
		'-extent',size.join('x'),
		'-gravity','North',
		'(',
			'-density', density,
			'-size',[qrsize,qrsize].join('x'),
			'svg:-',
		')',
		'-composite',
		'-negate',
		'-flop',
		'-colorspace','Gray',
		'-depth','1',
		'gray:-'
	];

	renderImage(size, args, svg);
}

function renderImage(size, args, input) {
	var result = [];
	var child = child_process.spawn('convert', args);
	
	if (input) child.stdin.end(input);

	child.stderr.on('data', data => console.error(data.toString()));
	child.stdout.on('data', data => result.push(data));
	child.on('close', () => {
		result = Buffer.concat(result);
		if (debug) {
			var child = child_process.spawn('convert', ['-size',size.join('x'),'-depth',1,'gray:-','temp.png']);
			child.stdin.end(result);
		} else {
			print(createPrintBuffer(result, size));
		}
	});
}

function createPrintBuffer(image, size) {
	let buffer = new Buffer(1024*1024);
	let pos = 0;

	write([0x1b,'@']); // Init
	write([0x1b,'i','z',0xa6,0x0a,0x3e,0,size[1] & 0xff,size[1] >> 8,0,0,0,0]); // Set media type
	write([0x1b,'i','K']); // Set cut type
	write([0x1b,'i','A']); // Enable cutter
	write([0x1b,'i','d',0,0]); // Set margin = 0

	var lb = Math.floor(size[0] / 8) + (size[0] % 8 > 0 ? 1 : 0);
	for (let y = 0; y < size[1]; y++) {
		write(['g', 0x00, 90]);
		copy(image.slice(y*lb, (y+1)*lb));
		for (let x = lb; lb < 90; lb++) write([0x00]);
	}

	write([0x1a]); // Print

	return buffer.slice(0,pos);

	function write(data) {
		data.forEach(value => {
			if (typeof value === 'string') value = value.charCodeAt(0);
			buffer.writeUInt8(value, pos);
			pos++;
		})
	}

	function copy(data) {
		data.copy(buffer, pos);
		pos += data.length;
	}

}

function print(buffer) {
	fs.writeFile('/dev/usb/lp0', buffer);
}








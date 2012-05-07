var EventEmitter = function(){
	this._events = {};
};
EventEmitter.prototype.on = function(e, fn){
	if(this._events[e]){
		this._events[e].push(fn);
	} else {
		this._events[e] = [fn];
	}
	return this;
};
EventEmitter.prototype.emit = function(e){
	var args = Array.prototype.slice.call(arguments, 1);
	if(this._events[e]){
		for(var i = 0; i < this._events[e].length; i++){
			this._events[e][i].apply(this, args);
		}
	}
};

var Operations = {
	// data manipulation
	'DAT': function(){ this.pc = undefined; },// do nothing (terminates current task)
	'MOV': function(){ this.core.read(this.b.address).aField = this.a.value; },
	// arithmics
	'ADD': function(){ this.core.read(this.b.address).aField = this.b.value + this.a.value; },
	'SUB': function(){ this.core.read(this.b.address).aField = this.b.value - this.a.value; },
	'MUL': function(){ this.core.read(this.b.address).aField = this.b.value * this.a.value; },
	'DIV': function(){ this.core.read(this.b.address).aField = (this.b.value / this.a.value) | 0; },
	'MOD': function(){ this.core.read(this.b.address).aField = this.b.value % this.a.value; },
	// branching
	'JMP': function(){ this.pc = this.a.address; },
	'JMZ': function(){ if(this.a.value == 0) { this.pc = this.b.address; } },
	'CMP': function(){ if(this.a.value == this.b.value) { this.pc = this.fold(this.pc + 1); } },
	// special
	'FRK': function(){ this.tasks.enqueue(this.a.address); },
	'CLR': function(){ this.core.read(this.a.address).clear(); },
	'CPY': function(){ this.write(this.b.address, this.core.read(this.a.address).clone()); }
};

var Instruction = function(opCode, aMode, aField, bMode, bField){
	this.opCode = opCode || 'DAT';
	this.aMode = aMode || 0;
	this.aField = aField || 0;
	this.bMode = bMode || 0;
	this.bField = bField || 0;
};
Instruction.prototype.clone = function(){
	return new Instruction(this.opCode, this.aMode, this.aField, this.bMode, this.bField);
};
Instruction.prototype.clear = function(){
	this.opCode = 'DAT';
	this.aMode = 0;
	this.aField = 0;
	this.bMode = 0;
	this.bField = 0;
};
Instruction.parse = function(loadInstruction){
	var mode = function(field){
		return field == '#' ? 0 : field == '@' ? 2 : 1;
	};
	var op = Operations[loadInstruction.opCode];
	if(!op){ throw 'Invalid op-code detected: ' + loadInstruction.opCode; }
	return new Instruction(
		loadInstruction.opCode, 
		mode(loadInstruction.aMode),
		loadInstruction.aField,
		mode(loadInstruction.bMode),
		loadInstruction.bField
	);
};

var Core = function(size){
	for(var i = 0; i < size; i++){
		this.push(new Instruction());
	}
};
Core.prototype = [];
Core.prototype.read = function(address){
	return this[this.fold(address)];
};
Core.prototype.write = function(address, instruction){
	this[this.fold(address)] = instruction;
};
Core.prototype.fold = function(address){
	return (address < 0 ? address + this.length - 1 : address) % this.length;
};

var Mars = function(config){
	this.config = {
		coreSize: config.coreSize   || 8192,
		maxCycles: config.maxCycles || 65536,
		maxLength: config.maxLength || 256,
		maxTasks: config.maxTasks   || 16
	};
	this.cycles = 0;
	this.core = new Core(this.config.coreSize);
	this.warriors = [];
};
Mars.prototype = new EventEmitter();
Mars.prototype.stepWarrior = function(warrior){
	var core = this.core;
	var pc = warrior.tasks.dequeue();
	var instruction = core.read(pc);

	this.emit('step', {name:warrior.name, address:pc, instruction:instruction});

	var resolve = function(mode, field){
		var address;
		switch(mode){
			case 0: // immediate
				return { value: field, address: pc };
			case 1: // relative
				address = core.fold(pc + field);
				return { value: core.read(address).aField, address: address };
			case 2: // indirect
				address = core.fold(pc + field);
				address = core.fold(address + core.read(address).aField);
				return { value: core.read(address).aField, address: address };
			default: throw 'Invalid addressing mode: ' + mode;
		}
	};
	var a = resolve(instruction.aMode, instruction.aField);
	var b = resolve(instruction.bMode, instruction.bField);
	pc = core.fold(pc + 1); // move instruction pointer one step forward by default
	
	var executionContext = {
		core: core,
		a: a,
		b: b,
		pc: pc,
		tasks: warrior.tasks,
	};

	var op = Operations[instruction.opCode];
	if(!op) { throw 'Invalid op-code detected: ' + instruction.opCode; }
	op.call(executionContext);
	if(executionContext.pc) { warrior.tasks.enqueue(executionContext.pc); }
};
Mars.prototype.step = function(){
	this.cycles++;
	var stillAlive = [];
	for(var i = 0; i < this.warriors.length; i++){
		var warrior = this.warriors[i];
		this.stepWarrior(warrior);
		if(warrior.isDead()){ this.emit('died', warrior.name); continue; }
		stillAlive.push(warrior);
	}
	if(stillAlive.length === 1){ this.emit('won', stillAlive[0].name); return false; }
	if(this.cycles === this.config.maxCycles){ this.emit('tie', this.cycles); return false; }

	return true;
};
Mars.prototype.loadWarriorFrom = function(text){
	try {
		var lastLoadAddress = this.warriors.length ? this.warriors[this.warriors.length - 1].peekTask() : 0;
		var randomStartAddressOffset = Math.random()*(this.config.coreSize - this.config.maxLength)|0;
		var loadOffset = lastLoadAddress + randomStartAddressOffset;
		
		var warrior = Warrior.loadFrom(this.config, text);
		warrior.name += this.warriors.length;
		if(warrior.instructions.length >= this.config.maxLength){
			this.emit('error', 'Warrior \'' + warrior.name + '\' exceeds (' + warrior.instructions.length + ') the instruction limit: ' + this.config.maxLength);
			return false;
		}
		
		for(var i = 0; i < warrior.instructions.length; i++){
			this.core.write(loadOffset + i, warrior.instructions[i]);
		}
		// adjust start address
		var pc = warrior.tasks.dequeue();
		pc = this.core.fold(pc + loadOffset);
		warrior.tasks.enqueue(pc);
		this.warriors.push(warrior);
		return true;
	} catch(err){
		this.emit('error', 'Warrior loading error:\n' + err);
		return false;
	}
};

var Warrior = function(name, pc, instructions){
	this.name = name;
	this.tasks = [pc];
	this.tasks.enqueue = function(pc){
		this.push(pc);
	};
	this.tasks.dequeue = function(){
		var pc = this.shift();
		return pc;
	};
	this.instructions = instructions;
};
Warrior.prototype.isDead = function(){ return this.tasks.length === 0; };
Warrior.prototype.isAlive = function(){ return this.tasks.length > 0; };
Warrior.prototype.peekTask = function(){
	if(this.isDead()){ throw 'Warrior \'' + this.name + '\' is dead'; }
	return this.tasks[0];
};
Warrior.loadFrom = function(config, text){

	var Directives = {
		'redcode': function(){ return true; },
		'name': function(value){ return value.trim(); },
		'assert': function(expr){
			var validExpr = /^(\s*(CORESIZE|MAXCYCLES|MAXLENGTH|MAXTASKS|\d+|\%|\+|-|\*|==))+\s*$/;
			if(!validExpr.test(expr)){ throw 'Invalid assert expression: ' + expr; }
			try {
				return (function(){
					var	CORESIZE = config.coreSize;
					var MAXCYCLES = config.maxCycles;
					var MAXLENGTH = config.maxLength;
					var MAXTASKS = config.maxTasks;
					return eval(expr);
				})();
			} catch(e) {
				return false;
			}
		}
	};

	var readAllLinesOf = function(text){ return text.split(/\n|\r\n|\n\r/); }

	var preProcess = function(lines){
		var re = /^\s*;\s*(\w+)(\s+(.+))?/;
		var directives = {redcode:false, assert:false};
		for(var i = 0; i < lines.length; i++){
			var match = re.exec(lines[i]);
			if(!match) { continue; }
			var directiveName = match[1].toLowerCase();
			var directiveParameter = match[3];
			var directive = Directives[directiveName];
			if(!directive) { continue; }
			directives[directiveName] = directive(directiveParameter);
		}
		return directives;
	};

	var loadInstructionsFrom = function(lines){
		var re = /^\s*((\w+)\s+)?([A-Z]{3})(\s+(([#,@])?(\w+)))?(\s+(([#,@])?(\w+)))?(?!;)/;
		var instructions = [];
		var origin = {};
		var labels = {};

		for(var i = 0; i < lines.length; i++){
			var match = re.exec(lines[i]);
			if(!match){ continue; }
			var instruction = {
				label: match[2],
				opCode: match[3].toUpperCase(),
				aMode: match[6],
				aField: match[7],
				bMode: match[10],
				bField: match[11],
			};
			if(instruction.opCode == 'END') { break; }
			if(instruction.label){
				if(instruction.opCode == 'EQU') {
					labels[instruction.label] = (function(value){ 
						return function(){ return value; };
					})(parseInt(instruction.aField, 10));
					continue;
				} else {
					labels[instruction.label] = (function(labelAddress){
						return function(instructionAddress){ return labelAddress - instructionAddress; };
					})(instructions.length);
				}
			}
			if(instruction.opCode == 'ORG') { 
				origin = instruction;
				continue;
			}
			instructions.push(instruction);
		}

		// resolve labels
		var resolve = function(field){
			if(isNaN(field)){
				if(typeof field === 'undefined') { return function(){ return field; } }
				var label = labels[field];
				if(typeof label === 'undefined'){
					throw 'Invalid label reference: ' + field;
				} else {
					return label;
				}
			} else {
				return function(){ return parseInt(field, 10); };
			}
		};
		for(var i = 0; i < instructions.length; i++){
			var instruction = instructions[i];
			instruction.aField = resolve(instruction.aField)(i);
			instruction.bField = resolve(instruction.bField)(i);
		}
		// determine origin of execution
		instructions.origin = resolve(origin.aField)(0) || 0;

		return instructions;
	};

	var lines = readAllLinesOf(text);
	var directives = preProcess(lines);
	if(!directives.redcode){ throw 'Missing filemarker: ;redcode'; }
	if(!directives.assert){ throw 'Warrior assert didn\'t pass'; }
	if(!directives.name){ throw 'Warrior must specify a name'; }
	var loadInstructions = loadInstructionsFrom(lines);
	var instructions = [];
	loadInstructions.forEach(function(loadInstruction){
		instructions.push(Instruction.parse(loadInstruction));
	});
	return new Warrior(directives.name, loadInstructions.origin, instructions);
};


var programText = require('fs').readFileSync('dwarf.red', 'utf-8');

var mars = new Mars({coreSize:8192,maxCycles:10});
mars.on('step', console.log);
mars.on('error', console.error);
mars.on('died', console.log);
mars.on('won', console.log);
mars.on('tie', console.log);
mars.loadWarriorFrom(programText);
mars.loadWarriorFrom(programText);

while(mars.step()){}


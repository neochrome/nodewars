# Nodewars

## Usage

    node wars.js program1.red program2.red [programN.red]

## About
Nodejs based implementation of the [Corewar](http://www.corewar.info) game. 
The objective of the game is to write a small assembly like program (redcode) 
and let it compete for sole survival in the memory (CORE) of a virtual computer.
A match begins by loading at least two competing programs to random (non overlapping)
regions of CORE. The supervising process (MARS) then executes one queued instruction
from each program in turn. This continues until only one program have any queued 
instructions (it wins) or the MAXCYCLES is reached (it's a tie).
For all instructions except DAT (which is counted as no-op) the next following 
instruction is queued (or the referred to instruction in the case of JMP/JMZ/CMP), 
and the and the execution continues for the next program. If a DAT instruction is
"executed" no next instruction is queued, which effectively "kills" the executing program
unless it has more instructions queued from earlier FRK instructions.


## Redcode
Each competing program is written in an assembly like language called Redcode. 
Each line of redcode has the following format:

    <label> <operator> <a-operand> <b-operand> ; comment

A line may also consist solely of a comment.

### Special comments
There are three special comments

* **;redcode**.
  Any valid redcode program must start with this file identifier.
* **;name program-name**.
  Specifies the name of the program.
* **;assert expr**.
  Describes any assumptions about the execution environment that must hold
  in order for the program to be valid. **expr** may be any valid simple mathematical
  expression which evaluates to true. Pre-defined environment labels available:

  * **CORESIZE** - The current size of CORE.
  * **MAXCYCLES** - The maximum number of execution cycles before the match is
  * **MAXLENGTH** - The maximum number of instructions a program may consists of.
    declared to be a tie.
  * **MAXTASKS** - The maximum number of tasks a program may fork.


The memory of the virtual computer is called CORE and is cyclic (the final 
addressing is done modulo the total size of CORE). 
All addressing is done relative the currently executing instruction and there are 
three different addressing modes:

* **Immediate**. 
  An actual numeric value. Prefix: #
* **Relative**. 
  A numeric value, referring to an instruction relative to the currently executing one. No prefix.
* **Indirect**. 
  Like relative, but instead of directly referring to an instruction, 
  it looks one step further ahead. Prefix: @

In addition to numerical values, defined *labels* may also be used as addressing operands.


### Supported operators
#### Data manipulation
* DAT - No-op instruction, holds a value in it's a-operand.
* MOV - Assigns the value of it's a-operand to it's b-operand.

#### Arithmics
Executes the arithmic operation with the value of it's a-operand to the value of it's 
b-operand and stores the result at the address of it's b-operand.

* ADD - Addition.
* SUB - Subtraction.
* MUL - Multiplication.
* DIV - Division (with fraction loss).
* MOD - Modulo.

#### Branching
* JMP - Sets the instruction pointer to the address in it's a-operand.
* JMZ - If the value of it's a-operand is zero, sets the instruction pointer to the 
        address in it's b-operand.
* CMP - If the value of it's a-operand is equal to the value of it's b-operand, 
        skips the next instruction.

#### Special
* FRK - Forks a new sub process/task by queuing an additional instruction pointer 
        to the address of it's a-operand.
* CLR - Re-writes the instruction at the address of it's a-operand as a DAT, 
        effectively making it into a no-op.
* CPY - Copies the instruction at the address of it's a-operand to the address of it's b-operand.

#### PreProcessing
* ORG - Denotes the starting instruction of the program. 
        May be used to skip of data sections and such.
* END - Denotes the last instruction of the program. 
        Any lines after an END will be discarded and loaded.
* EQU - Simple textual (macro) expansion. Replaces any occurrence of 
        *label* with the value of it's a-operand while loading.


### Example
    ;redcode
    ;name    dwarf
    ;assert  CORESIZE % 4 == 0
             ORG start
    step     EQU #4
    target   DAT #0
    start    ADD #step   target
             CLR @target
             JMP start
             END


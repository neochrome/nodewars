;redcode
;name		dwarf
;assert	CORESIZE % 4 == 0

;constants available for assert:
; CORESIZE  - total size of the memory available
; MAXCYCLES - maximum number of cycles before a tie is declared
; MAXLENGTH - maximum number of instructions for a warrior
; MAXTASKS  - maximum number of tasks a warrior may fork

				ORG 0
				ORG start ; no, start from label instead
step		EQU	#4
; now follows the actual program
target	DAT #0
start		ADD #step	target

				CLR	@target
				JMP	start

				END
; anything after an END is ignored, even proper instructions:
				JMP target

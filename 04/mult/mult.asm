// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Mult.asm

// Multiplies R0 and R1 and stores the result in R2.
// (R0, R1, R2 refer to RAM[0], RAM[1], and RAM[2], respectively.)

// R2 = R0 * R1

    @R2
    M=0

    // counter = R1
    @R1
    D=M
    @counter
    M=D

(LOOP)
    // counter == 0 就結束
    @counter
    D=M
    @END
    D;JEQ

    // R2 = R2 + R0
    @R0
    D=M
    @R2
    M=D+M

    // counter--
    @counter
    M=M-1

    // 回到 LOOP
    @LOOP
    0;JMP

(END)
    @END
    0;JMP
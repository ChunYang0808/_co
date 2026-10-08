// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed. 
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

(LOOP)
    // 檢查鍵盤
    @KBD
    D=M

    // 沒有按鍵就填白色
    @WHITE
    D;JEQ

    // 有按鍵就填黑色
    @color
    M=-1
    @DRAW
    0;JMP

(WHITE)
    @color
    M=0

(DRAW)
    // 從螢幕第一個位址開始
    @SCREEN
    D=A
    @addr
    M=D

(FILL)
    // color 放進目前的螢幕記憶體
    @color
    D=M
    @addr
    A=M
    M=D

    // addr++
    @addr
    M=M+1

    // 判斷是否已經到 KBD
    @KBD
    D=A
    @addr
    D=D-M

    @FILL
    D;JGT

    // 整個畫面處理完，再重新檢查鍵盤
    @LOOP
    0;JMP
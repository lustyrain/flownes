import 'babel-polyfill';
import assert from 'power-assert';
import EventEmitter from 'events';
import CPU from '../src/cpu';
import RAM from '../src/ram';
import ROM from '../src/rom';
import * as op from '../src/cpu/opcode';

const defaultRegistors = {
  A: 0x00,
  X: 0x00,
  Y: 0x00,
  P: {
    negative: false,
    overflow: false,
    reserved: true,
    break: true,
    decimal: false,
    interrupt: true,
    zero: false,
    carry: false,
  },
  SP: 0x01FF, // 0xFD?
  PC: 0x0000,
};

describe ('cpu spec', () => {
  describe ('instructions', () => {
    let cpu;
    let emitter;
    let mockedROM;
    let mockedMemory;

    beforeEach(() => {
      emitter = new EventEmitter();
      cpu = new CPU(emitter);
      cpu.registors.PC = 0x8000;
      mockedMemory = new RAM(0x10000);
      emitter.on('cpu:read', ([addr, size]) => {
        let data: Uint8Array;
        if (addr >= 0x8000) {
          data = mockedROM.read(addr - 0x8000, size);
        } else {
          data = mockedMemory.read(addr, size);
        }
        emitter.emit('cpu:read-response', data);
      });
      emitter.on('cpu:write', ([addr, data]) => {
        mockedMemory.write(addr, data);
      });
    });

    describe ('LDA', () => {
      it('LDA_IMM', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_IMM, 0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8002,
          A: 0xAA,
        };
        assert.equal(cycle, 2);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_ZERO', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_ZERO, 0xA5]));
        mockedMemory.write(0xA5, new Uint8Array([0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8002,
          A: 0xAA,
        };
        assert.equal(cycle, 3);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_ZEROX', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_ZEROX, 0xA5]));
        cpu.registors.X = 0x05;
        mockedMemory.write(0xAA, new Uint8Array([0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8002,
          A: 0xAA,
          X: 0x05,
        };
        assert.equal(cycle, 4);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_ABS', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_ABS, 0xA5, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8003,
          A: 0xAA,
        };
        assert.equal(cycle, 4);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_ABSX', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_ABSX, 0xA5, 0x10]));
        cpu.registors.X = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8003,
          A: 0xAA,
          X: 0x05,
        };
        assert.equal(cycle, 4);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_ABSY', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_ABSY, 0xA5, 0x10]));
        cpu.registors.Y = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xAA]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8003,
          A: 0xAA,
          Y: 0x05,
        };
        assert.equal(cycle, 4);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_INDX', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_INDX, 0xA5]));
        cpu.registors.X = 0x05;
        mockedMemory.write(0xAA, new Uint8Array([0xA0]));
        mockedMemory.write(0xA0, new Uint8Array([0xDE]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8002,
          A: 0xDE,
          X: 0x05,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LDA_INDY', async () => {
        mockedROM = new ROM(new Uint8Array([op.LDA_INDY, 0xA5]));
        cpu.registors.Y = 0x05;
        mockedMemory.write(0xA5, new Uint8Array([0xA0, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xDE]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, negative: true },
          PC: 0x8002,
          A: 0xDE,
          Y: 0x05,
        };
        assert.equal(cycle, 5);
        assert.deepEqual(cpu.registors, expected);
      });
    });

    it('SEI', async () => {
      mockedROM = new ROM(new Uint8Array([op.SEI]));
      const cycle = await cpu.exec();
      const expected = {
        ...defaultRegistors,
        P: { ...defaultRegistors.P, interrupt: true },
        PC: 0x8001,
      };
      assert.equal(cycle, 2);
      assert.deepEqual(cpu.registors, expected);
    });

    it('CLI', async () => {
      mockedROM = new ROM(new Uint8Array([op.CLI]));
      const cycle = await cpu.exec();
      const expected = {
        ...defaultRegistors,
        P: { ...defaultRegistors.P, interrupt: false },
        PC: 0x8001,
      };
      assert.equal(cycle, 2);
      assert.deepEqual(cpu.registors, expected);
    });

    describe ('LSR', () => {
      it('LSR', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR]));
        cpu.registors.A = 0xa5;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true },
          PC: 0x8001,
          A: 0x52,
        };
        assert.equal(cycle, 2);
        assert.deepEqual(cpu.registors, expected);
      });

      it('LSR_ZERO', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR_ZERO, 0xA5]));
        mockedMemory.write(0xA5, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 5);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xA5)[0], 0x77);
      });

      it('LSR_ZEROX', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR_ZEROX, 0xA5]));
        mockedMemory.write(0xAA, new Uint8Array([0xEF]));
        cpu.registors.X = 0x05;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          X: 0x05,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xAA)[0], 0x77);
      });

      it('LSR_ABS', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR_ABS, 0xA5, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10A5)[0], 0x77);
      });

      it('LSR_ABSX without page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR_ABSX, 0xA5, 0x10]));
        cpu.registors.X = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0x05,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10AA)[0], 0x77);
      });

      it('LSR_ABSX with page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.LSR_ABSX, 0x01, 0x10]));
        cpu.registors.X = 0xFF;
        mockedMemory.write(0x1100, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0xFF,
        };
        assert.equal(cycle, 7);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x1100)[0], 0x77);
      });
    });

    describe ('ASL', () => {
      it('ASL', async () => {
        mockedROM = new ROM(new Uint8Array([op.ASL]));
        cpu.registors.A = 0xa5;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true },
          PC: 0x8001,
          A: 0x4A,
        };
        assert.equal(cycle, 2);
        assert.deepEqual(cpu.registors, expected);
      });

      it('ASL_ZERO', async () => {
        mockedROM = new ROM(new Uint8Array([op.ASL_ZERO, 0xA5]));
        mockedMemory.write(0xA5, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 5);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xA5)[0], 0xDE);
      });

      it('ASL_ZEROX', async () => {
        mockedROM = new ROM(new Uint8Array([op.ASL_ZEROX, 0xA5]));
        mockedMemory.write(0xAA, new Uint8Array([0xEF]));
        cpu.registors.X = 0x05;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          X: 0x05,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xAA)[0], 0xDE);
      });

      it('ASL_ABS', async () => {
        mockedROM = new ROM(new Uint8Array([op.ASL_ABS, 0xA5, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10A5)[0], 0xDE);
      });

      it('ASL_ABSX without page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.ASL_ABSX, 0xA5, 0x10]));
        cpu.registors.X = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0x05,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10AA)[0], 0xDE);
      });

      it('ASL_ABSX with page cross', async() => {
        mockedROM = new ROM(new Uint8Array([op.ASL_ABSX, 0x01, 0x10]));
        cpu.registors.X = 0xFF;
        mockedMemory.write(0x1100, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0xFF,
        };
        assert.equal(cycle, 7);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x1100)[0], 0xDE);
      });
    });

    describe ('ROR', () => {
      it('ROR', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR]));
        cpu.registors.A = 0xa5;
        cpu.registors.P.carry = true;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true },
          PC: 0x8001,
          A: 0xD2,
        };
        assert.equal(cycle, 2);
        assert.deepEqual(cpu.registors, expected);
      });

      it('ROR_ZERO', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR_ZERO, 0xA5]));
        mockedMemory.write(0xA5, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 5);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xA5)[0], 0xF7);
      });

      it('ROR_ZEROX', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR_ZEROX, 0xA5]));
        mockedMemory.write(0xAA, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0x05;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          X: 0x05,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xAA)[0], 0xF7);
      });

    it('ROR_ABS', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR_ABS, 0xA5, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10A5)[0], 0xF7);
      });

      it('ROR_ABSX without page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR_ABSX, 0xA5, 0x10]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0x05,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10AA)[0], 0xF7);
      });

      it('ROR_ABSX with page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROR_ABSX, 0x01, 0x10]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0xFF;
        mockedMemory.write(0x1100, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0xFF,
        };
        assert.equal(cycle, 7);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x1100)[0], 0xF7);
      });
    });

    describe ('ROL', () => {
      it('ROL', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL]));
        cpu.registors.P.carry = true;
        cpu.registors.A = 0xa5;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true },
          PC: 0x8001,
          A: 0x4B,
        };
        assert.equal(cycle, 2);
        assert.deepEqual(cpu.registors, expected);
      });

      it('ROL_ZERO', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL_ZERO, 0xA5]));
        mockedMemory.write(0xA5, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 5);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xA5)[0], 0xDF);
      });

      it('ROL_ZEROX', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL_ZEROX, 0xA5]));
        mockedMemory.write(0xAA, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0x05;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          X: 0x05,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8002,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0xAA)[0], 0xDF);
      });

      it('ROL_ABS', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL_ABS, 0xA5, 0x10]));
        mockedMemory.write(0x10A5, new Uint8Array([0xEF]));
        cpu.registors.P.carry = true;
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10A5)[0], 0xDF);
      });

      it('ROL_ABSX without page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL_ABSX, 0xA5, 0x10]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0x05;
        mockedMemory.write(0x10AA, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0x05,
        };
        assert.equal(cycle, 6);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x10AA)[0], 0xDF);
      });

      it('ROL_ABSX with page cross', async () => {
        mockedROM = new ROM(new Uint8Array([op.ROL_ABSX, 0x01, 0x10]));
        cpu.registors.P.carry = true;
        cpu.registors.X = 0xFF;
        mockedMemory.write(0x1100, new Uint8Array([0xEF]));
        const cycle = await cpu.exec();
        const expected = {
          ...defaultRegistors,
          P: { ...defaultRegistors.P, carry: true, zero: true },
          PC: 0x8003,
          X: 0xFF,
        };
        assert.equal(cycle, 7);
        assert.deepEqual(cpu.registors, expected);
        assert.equal(mockedMemory.read(0x1100)[0], 0xDF);
      });
    });
  });
});

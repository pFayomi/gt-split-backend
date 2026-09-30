import { Test, TestingModule } from '@nestjs/testing';
import { SplitsController } from './splits.controller';

describe('SplitsController', () => {
  let controller: SplitsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SplitsController],
    }).compile();

    controller = module.get<SplitsController>(SplitsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SplitsService } from './splits.service';

describe('SplitsService', () => {
  let service: SplitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SplitsService],
    }).compile();

    service = module.get<SplitsService>(SplitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

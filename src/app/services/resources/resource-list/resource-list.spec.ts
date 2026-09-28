import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ResourceList } from './resource-list';
import { ResourceService } from '../../resource.service';

describe('ResourceList', () => {
  let component: ResourceList;
  let fixture: ComponentFixture<ResourceList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceList],
      providers: [
        provideRouter([]),
        {
          provide: ResourceService,
          useValue: { getAll: () => of([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

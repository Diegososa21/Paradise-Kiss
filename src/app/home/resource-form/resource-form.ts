import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-resource-form',
  styleUrl: './resource-form.scss',
  templateUrl: './resource-form.html',
  
})
export class ResourceForm {
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
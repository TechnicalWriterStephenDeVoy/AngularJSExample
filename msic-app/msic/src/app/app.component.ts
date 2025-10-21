import { Component, OnInit } from '@angular/core';
import { DataService } from './data.service'; // Import the data service
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [CommonModule],
  standalone: true
})
export class AppComponent implements OnInit {
  data: any[] = []; // Property to store the data
  title = 'msic';

  constructor(private dataService: DataService) {} // Inject the data service
  
  ngOnInit(): void {
    this.dataService.getData().subscribe((data) => {
      this.data = data; // Assign the received data to the property
    }, (error) => {
      console.error('There was an error retrieving data:', error);
    });
  }
}

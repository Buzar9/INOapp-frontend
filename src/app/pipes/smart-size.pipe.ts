import { Pipe, PipeTransform } from '@angular/core';
import { SizeView } from '../services/response/BackgroundMap';

const UNITS_ORDER = ['bytes', 'kb', 'mb', 'gb'];

@Pipe({
    name: 'smartSize',
    standalone: true,
})
export class SmartSizePipe implements PipeTransform {
    transform(size: SizeView): string {
        const defaultUnit = size.defaultUnit || 'mb';
        let unitIndex = UNITS_ORDER.indexOf(defaultUnit);
        if (unitIndex === -1) {
            unitIndex = 2;
        }

        if (!size.values || Object.keys(size.values).length === 0) {
            return `- ${UNITS_ORDER[unitIndex].toUpperCase()}`;
        }

        let value = size.values[UNITS_ORDER[unitIndex]] ?? 0;

        while (value < 1 && unitIndex > 0) {
            unitIndex--;
            value = size.values[UNITS_ORDER[unitIndex]] ?? 0;
        }

        while (value > 1024 && unitIndex < UNITS_ORDER.length - 1) {
            unitIndex++;
            value = size.values[UNITS_ORDER[unitIndex]] ?? 0;
        }

        return `${value} ${UNITS_ORDER[unitIndex].toUpperCase()}`;
    }
}

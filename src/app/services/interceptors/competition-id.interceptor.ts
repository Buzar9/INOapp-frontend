import { HttpInterceptorFn } from '@angular/common/http';

export const competitionIdInterceptor: HttpInterceptorFn = (req, next) => {
  // dodo hardcoded - docelowo z logowania organizatora
  const competitionId = 'Competition123';

  if (req.url.includes('/backoffice') && !req.url.includes('/backoffice/create')) {
    const cloned = req.clone({
      setHeaders: { 'X-Competition-Id': competitionId }
    });
    return next(cloned);
  }

  return next(req);
};

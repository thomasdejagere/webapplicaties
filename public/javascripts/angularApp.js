
angular.module('flapperNews', ['ui.router', 'ngAnimate', 'ngMaterial','growlNotifications'])

	.config([
		'$stateProvider',
		'$urlRouterProvider',
		function ($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('home', {
					url: '/home',
					templateUrl: '/home.html',
					controller: 'MainCtrl',
					//dit is een geschikte plaats om de posts in te laden van de backend
					//door de resolve zal alle posts van de backend geladen worden iedere keer
					//we ons in de home state bevinden.
					resolve: {
						postPromise: ['posts', function (posts) {
							return posts.getAll();
						}]
					}
				})
				.state('posts', {
					url: '/posts/{id}',
					templateUrl: '/posts.html',
					controller: 'PostsCtrl',
					//de angular ui router ziet wanneer we de posts state ingaan dat we automatisch de server querying voor het volledige post object met de comments erbij.
					//wanneer de request gereturned heeft zal de state succesvol laden. 
					resolve: {
						post: ['$stateParams', 'posts', function ($stateParams, posts) {
							return posts.get($stateParams.id);
						}]
					}
				})
				.state('login', {
					url: '/login',
					templateUrl: '/login.html',
					controller: 'AuthCtrl',
					onEnter: ['$state', 'auth', function ($state, auth) {
						if (auth.isLoggedIn()) {
							$state.go('home');
						}
					}]
				})
				.state('register', {
					url: '/register',
					templateUrl: '/register.html',
					controller: 'AuthCtrl',
					onEnter: ['$state', 'auth', function ($state, auth) {
						if (auth.isLoggedIn()) {
							$state.go('home');
						}
					}]
				})
				.state('directive', {
					url: '/directive',
					templateUrl: '/directive.html',
					controller: 'DirectiveCtrl',

				});

			$urlRouterProvider.otherwise('home');
		}])


	.controller('NavCtrl', [
		'$scope',
		'auth',
		function ($scope, auth) {
			$scope.isLoggedIn = auth.isLoggedIn;
			$scope.currentUser = auth.currentUser;
			$scope.logOut = auth.logOut;

			$scope.isOpen = false;
      $scope.demo = {
        isOpen: false,
        count: 5,
        selectedDirection: 'left',
				showTooltip: false,
				tipDirection: ''
      };

			$scope.$watch('demo.tipDirection', function (val) {
				if (val && val.length) {
					$scope.demo.showTooltip = true;
				}
			})
		}])

	.factory('auth', ['$http', '$window', function ($http, $window) {
		var auth = {};

		auth.saveToken = function (token) {
			$window.localStorage['flapper-news-token'] = token;
		};

		auth.getToken = function () {
			return $window.localStorage['flapper-news-token'];
		};

		auth.isLoggedIn = function () {
			var token = auth.getToken();

			if (token) {
				//atob dient om een JSON te stringifien. En via JSON.parse naar een javascript object
				var payload = JSON.parse($window.atob(token.split('.')[1]));
				//controleren of de token niet expired is
				return payload.exp > Date.now() / 1000;
			} else {
				return false;
			}
		};
		auth.currentUser = function () {
			if (auth.isLoggedIn()) {
				var token = auth.getToken();
				var payload = JSON.parse($window.atob(token.split('.')[1]));

				return payload.username;
			}
		};
		auth.register = function (user) {
			return $http.post('/register', user).success(function (data) {
				auth.saveToken(data.token);
			});
		};
		auth.logIn = function (user) {
			return $http.post('/login', user).success(function (data) {
				auth.saveToken(data.token);
			});
		};
		auth.logOut = function () {
			$window.localStorage.removeItem('flapper-news-token');
		};
		return auth;

	}])

	.controller('AuthCtrl', [
		'$scope',
		'$state',
		'auth',
		function ($scope, $state, auth) {
			$scope.user = {};

			$scope.register = function () {
				auth.register($scope.user).error(function (error) {
					$scope.error = error;
				}).then(function () {
					$state.go('home');
				});
			};
			$scope.logIn = function () {
				auth.logIn($scope.user).error(function (error) {
					$scope.error = error;
				}).then(function () {
					$state.go('home');
				});
			};
		}])

	.factory('posts', ['$http', 'auth', function ($http, auth) {
		//service body
		var o = {
			posts: []
		};
		o.getAll = function () {
			return $http.get('/posts').success(function (data) {
				//copy is nodig om een diepe copy te kunnen maken van de gereturnde data.
				//dit maakt dat de $scope.posts variabele in de MainCtrl ook wordt geupdate zodat
				//de controller met de nieuwste data werkt.
				angular.copy(data, o.posts);
			});
		};

		o.get = function (id) {
			return $http.get('/posts/' + id).then(function (res) {
				return res.data;
			});
		};

		o.create = function (post) {
			return $http.post('/posts', post, {
				headers: { Authorization: 'Bearer ' + auth.getToken() }
			}).success(function (data) {
				o.posts.push(data);
			});
		};

		o.upvote = function (post) {
			return $http.put('/posts/' + post._id + '/upvote', null, {
				headers: { Authorization: 'Bearer ' + auth.getToken() }
			}).success(function (data) {
				post.upvotes += 1;
			});
		};

		o.addComment = function (id, comment) {
			return $http.post('/posts/' + id + '/comments', comment, {
				headers: { Authorization: 'Bearer ' + auth.getToken() }
			});
		};

		o.upvoteComment = function (post, comment) {
			return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
				headers: { Authorization: 'Bearer ' + auth.getToken() }
			}).success(function (data) {
				comment.upvotes += 1;
			});
		};

		return o;
	}])


	.controller('MainCtrl', [
		'$scope',
		'auth',
		'posts',
		function ($scope, auth, posts) {
			$scope.isLoggedIn = auth.isLoggedIn;
			$scope.posts = posts.posts;

			$scope.addPost = function () {
				if (!$scope.title || $scope.title === '') { return; }
				posts.create({
					title: $scope.title,
					link: $scope.link,
				});
				$scope.title = '';
				$scope.link = '';
			};
			$scope.body = '';
			//alertdialog
			
			$scope.incrementUpvotes = function (post) {
				posts.upvote(post);
			};
		}])

	.controller('PostsCtrl', [
		'$scope',
		'posts',
		'post',
		'auth',
		function ($scope, posts, post, auth) {
			$scope.post = post;
			$scope.isLoggedIn = auth.isLoggedIn;

			$scope.addComment = function () {
				if ($scope.body === '') { return; }
				posts.addComment(post._id, {
					body: $scope.body,
					author: 'user',
				});
				$scope.post.comments.push({
					body: $scope.body,
					author: 'user',
					upvotes: 0
				});
			};

			/*$scope.addComment = function () {
				if ($scope.body === '') { return; }
				posts.addComment(post._id, {
					body: $scope.body,
					author: 'user',
				}).success(function (comment) {
					$scope.post.comments.push(comment);
				});
				$scope.body = '';
			};*/

			$scope.incrementUpvotes = function (comment) {
				posts.upvoteComment(post, comment);
			};
		}])
	
	
//SLIDER
/*The important thing to note is that we have isolated the scope of our directive. 
Since we will need several functions/properties only for the internal usage, 
we’ve chosen to create an isolated scope instead of polluting the parent scope. 
Also we should be able to accept a list of images from the parent scope for displaying. 
That’s why we are using a = binding. 
Finally, the template for the directive goes inside the templateurl.html file.*/

	.directive('slider', function ($timeout) {
		return {
			restrict: 'AE',
			replace: true,
			scope: {
				images: '='
			},
			link: function (scope, elem, attrs) {
				scope.currentIndex = 0;
				scope.next = function () {
					scope.currentIndex < scope.images.length - 1 ? scope.currentIndex++ : scope.currentIndex = 0;
				};
				scope.prev = function () {
					scope.currentIndex > 0 ? scope.currentIndex-- : scope.currentIndex = scope.images.length - 1;
				};
				//vanaf dat de currentindex wijzigt zet hij alle images hun visibility op false en de currentimage op true;
				scope.$watch('currentIndex', function () {
					scope.images.forEach(function (image) {
						image.visible = false;
					});
					scope.images[scope.currentIndex].visible = true;
				});

				var timer;
				var sliderFunc = function () {
					timer = $timeout(function () {
						scope.next();
						timer = $timeout(sliderFunc, 5000);
					}, 5000);
				};

				sliderFunc();

				scope.$on('$destroy', function () {
					$timeout.cancel(timer); //when the scope is getting destroyed, cancel the timer;
				});
			},
			templateUrl: './templates/templateurl.html'
		};
	})

	.controller('DirectiveCtrl', [
		'$scope',
		'auth',
		function ($scope, auth) {
			$scope.isLoggedIn = auth.isLoggedIn;
			$scope.images = [{
			src: 'img1.png',
			title: 'Pic 1'
		}, {
				src: 'img2.png',
				title: 'Pic 2'
			}, {
				src: 'img3.png',
				title: 'Pic 3'
			}, {
				src: 'img4.png',
				title: 'Pic 4'
			}, {
				src: 'img5.png',
				title: 'Pic 5'
			}];
		}
	])

	.controller('BasicDemoCtrl', DemoCtrl);
	function DemoCtrl($timeout, $q) {
	var self = this;
	self.readonly = false;
	// Lists of fruit names and Vegetable objects
	self.fruitNames = ['Apple', 'Banana', 'Orange'];
	self.roFruitNames = angular.copy(self.fruitNames);
	self.tags = [];
	self.vegObjs = [
		{
			'name': 'Broccoli',
			'type': 'Brassica'
		},
		{
			'name': 'Cabbage',
			'type': 'Brassica'
		},
		{
			'name': 'Carrot',
			'type': 'Umbelliferous'
		}
	];
	self.newVeg = function (chip) {
		return {
			name: chip,
			type: 'unknown'
		};
	};
};